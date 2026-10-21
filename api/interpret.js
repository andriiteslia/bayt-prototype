// Vercel serverless function: POST /api/interpret
// The API key lives only here (env ANTHROPIC_API_KEY). The browser never sees it.
// The model only turns words into criteria; matching and listing facts stay in our code.
// Any failure returns { ok:false } and the client falls back to the scripted interpreter.

import { normalize, FIELDS, FEATURES, MONTHS } from '../src/lib/normalize.js';
import { AREAS } from '../src/data/areas.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const MAX_INPUT = 500;
const TIMEOUT_MS = 8000;

// Best-effort per-instance rate limit. Real protection is the spend limit in the Anthropic console.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000, max = 20;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

const AREA_LIST = Object.entries(AREAS).map(([k, a]) => `- ${k}: ${a.name}. ${a.intro}`).join('\n');

const SYSTEM = `You read how a renter describes the home they want in Dubai and record what they mean, as criteria for a search over rental listings. You never describe listings, prices of specific homes or facts about buildings; you only interpret the renter.

Return your answer only by calling record_understanding.

CERTAINTY — be honest about it, it is shown to the renter:
- "said": the renter stated it directly ("2 bedrooms", "under 140k", "we have a dog" → pets).
- "assumed": you translated something vague into something searchable ("quiet", "spacious", "near work" without minutes, "cheap" without a number, a budget whose period you guessed). Give a one-sentence "detail" in first person explaining the reading, e.g. "I read 'quiet' as away from nightlife and main roads."

WEIGHT:
- "must" for hard numbers and explicit requirements: bedrooms, a stated budget, a stated max travel time, pets they own, property type, furnishing, named areas, areas to avoid.
- "nice" for preferences and vibes: quiet, lively, park, schools, beach, metro nearby, amenities, move month, assumed travel time.

QUOTE: copy the renter's exact words (a short fragment, verbatim) that each item came from. Never paraphrase in "quote".

FIELDS (value format):
- beds: integer, 0 = studio. orMore=true for "3+" / "at least 3".
- budget: integer, AED per YEAR. Dubai rents are yearly; convert monthly ×12. A bare number under 30,000 is almost certainly monthly → convert and mark assumed. "cheap/affordable" without a number → 110000, assumed.
- commute: {hub, to, max, mode, modeSaid}. hub "DIFC" covers DIFC, Downtown and Business Bay offices; hub "DIC" covers Internet City, Media City, Knowledge Park and JLT offices. "to" = the workplace as the renter named it (short). max = minutes (default 30 if unstated → assumed). mode "car" or "metro"; modeSaid=false if they didn't say how they travel (then assume car). Workplace elsewhere → don't add commute; add a cantcheck note that travel times are only available to DIFC and Internet City areas in this demo.
- pets: true. park: walking minutes (default 10). quiet/lively/beach: true. schools: 2 (well-rated schools within 2 km). metro: walking minutes (default 10).
- type: "apartment" | "villa" | "townhouse". furnished: true | false. size: sq ft ("spacious" → 1200, assumed).
- available: move-in month, one of ${MONTHS.join(', ')}. Other months → skip and add a cantcheck note.
- areas / avoid: arrays of area keys from the list below. Map neighbourhood names and nicknames (JBR → marina, Meydan → sobha). Only use keys from the list.
- feature: one of ${FEATURES.join(', ')} (one criterion per feature).

AREAS:
${AREA_LIST}

NOTES:
- "cantcheck": things the renter wants that no listing data can verify — safety, nice neighbours, natural light, views, construction noise, community feel, whether a school has places. Say plainly what you can't check and, briefly, what they could do instead. One note per topic.
- "declined": requests to filter by who lives nearby — nationality, ethnicity, religion, families/kids, bachelors, etc. Do not turn them into any criterion or proxy. Say you don't filter by who lives nearby and offer neutral alternatives (quiet streets, low traffic, gated community).
- "outofscope": buying, mortgages, investment, short stays/holiday rentals. Say this search covers yearly rentals.

newcomer: true if they are moving to Dubai / new to the city / don't know the areas.

Where the renter works is a commute, not an area to live in: never put the workplace into "areas" unless they say they want to live there.
A budget with an explicit period ("10k a month", "150k a year") is "said", even after you convert it.
Only add a note when the renter actually raised that topic. Never add a "declined" note unless they asked to filter by who lives nearby, and never add a "cantcheck" note about safety, neighbours or anything else they didn't mention.
Do not invent criteria the renter didn't express. Fewer, correct items beat many guesses. Write notes and details in plain, friendly English, max 30 words each.`;

const SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: FIELDS },
          value: { description: 'Format depends on field; see instructions.' },
          orMore: { type: 'boolean' },
          weight: { type: 'string', enum: ['must', 'nice'] },
          certainty: { type: 'string', enum: ['said', 'assumed'] },
          quote: { type: 'string', description: "Verbatim fragment of the renter's words." },
          detail: { type: 'string', description: 'For assumed items: one sentence on how you read it.' },
        },
        required: ['field', 'value', 'weight', 'certainty', 'quote'],
      },
    },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['cantcheck', 'declined', 'outofscope'] },
          text: { type: 'string' },
          quote: { type: 'string' },
        },
        required: ['kind', 'text'],
      },
    },
    newcomer: { type: 'boolean' },
    changes: { type: 'array', items: { type: 'string' }, description: 'Only when refining: short descriptions of what changed, e.g. Removed "Park within 10 min walk".' },
  },
  required: ['criteria', 'notes', 'newcomer'],
};

function userMessage(text, current) {
  if (!current) return `Renter's description:\n"""${text}"""`;
  return `Current understanding (JSON):\n${JSON.stringify(current)}\n\nThe renter now adds:\n"""${text}"""\n\nReturn the COMPLETE updated understanding: keep everything that still applies, change or remove what the new message changes, add what is new. Quotes may come from either message. Fill "changes".`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, error: 'no_key' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  if (limited(ip)) return res.status(200).json({ ok: false, error: 'rate_limited' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const text = String(body.text || '').trim().slice(0, MAX_INPUT);
  if (!text) return res.status(400).json({ ok: false, error: 'empty' });
  const current = body.current && Array.isArray(body.current.criteria)
    ? { criteria: body.current.criteria.map(({ field, value, weight, certainty, quote, orMore }) => ({ field: field.startsWith('feature:') ? 'feature' : field, value, weight, certainty, quote, orMore })), notes: (body.current.notes || []).filter((n) => n.kind !== 'empty'), newcomer: !!body.current.newcomer }
    : null;
  const quoteSource = [text, body.previousText || ''].join('\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        tools: [{ name: 'record_understanding', description: "Record the renter's search criteria and notes.", input_schema: SCHEMA }],
        tool_choice: { type: 'tool', name: 'record_understanding' },
        messages: [{ role: 'user', content: userMessage(text, current) }],
      }),
    });
    if (!r.ok) {
      // Upstream error type/message only (never the key), to diagnose from the browser
      let detail = '';
      try { const e = await r.json(); detail = `${e.error?.type || ''}: ${e.error?.message || ''}`.slice(0, 300); } catch {}
      return res.status(200).json({ ok: false, error: 'upstream_' + r.status, detail });
    }
    const data = await r.json();
    const call = (data.content || []).find((b) => b.type === 'tool_use');
    if (!call) return res.status(200).json({ ok: false, error: 'no_tool_call' });
    const understanding = normalize(call.input, quoteSource);
    return res.status(200).json({ ok: true, understanding, ms: Date.now() - started, model: MODEL });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.name === 'AbortError' ? 'timeout' : 'invalid' });
  } finally {
    clearTimeout(timer);
  }
}
