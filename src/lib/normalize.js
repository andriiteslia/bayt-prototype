// Turns a model response into the exact shape the UI renders — or throws.
// Used on the server (to decide whether to fall back) and kept free of browser APIs.
// Rule: the model decides WHAT the renter meant; labels, units and limits are ours.

import { AREAS } from '../data/areas.js';

export const FIELDS = ['beds', 'budget', 'commute', 'pets', 'park', 'quiet', 'lively', 'schools', 'metro', 'type', 'furnished', 'size', 'beach', 'available', 'areas', 'avoid', 'feature'];
export const FEATURES = ['pool', 'gym', 'balcony', 'garden', 'parking'];
export const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const MONTH_NAME = { Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May' };
const areaName = (k) => AREAS[k].name.replace(/ \(.*\)/, '');
const int = (v, lo, hi) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error('range'); return n; };
const fmtK = (n) => Math.round(n / 1000) + 'k';

export function labelFor(c) {
  const v = c.value;
  switch (c.field) {
    case 'beds': return v === 0 ? 'Studio' : `${v}${c.orMore ? '+' : ''} bedroom${v > 1 ? 's' : ''}`;
    case 'budget': return `Up to ${fmtK(v)} a year`;
    case 'commute': return `≤ ${v.max} min to ${v.to} by ${v.mode === 'metro' ? 'metro' : 'car'}`;
    case 'pets': return 'Pets allowed';
    case 'park': return `Park within ${v} min walk`;
    case 'quiet': return 'Quiet';
    case 'lively': return 'Lively and walkable';
    case 'schools': return 'Good schools nearby';
    case 'metro': return `Metro within ${v} min walk`;
    case 'type': return v[0].toUpperCase() + v.slice(1);
    case 'furnished': return v ? 'Furnished' : 'Unfurnished';
    case 'size': return `${v.toLocaleString('en-US')}+ sq ft`;
    case 'beach': return 'Close to the beach';
    case 'available': return `Move in ${MONTH_NAME[v]}`;
    case 'areas': return v.map(areaName).join(', ');
    case 'avoid': return 'Not ' + v.map(areaName).join(', ');
    default: if (c.field.startsWith('feature:')) return v[0].toUpperCase() + v.slice(1);
  }
  return String(v);
}

function value(field, raw) {
  switch (field) {
    case 'beds': return int(raw, 0, 6);
    case 'budget': return int(raw, 20000, 2000000);
    case 'park': case 'metro': return int(raw, 3, 30);
    case 'schools': return int(raw, 1, 4);
    case 'size': return int(raw, 300, 10000);
    case 'pets': case 'quiet': case 'lively': case 'beach': return true;
    case 'furnished': if (typeof raw !== 'boolean') throw new Error('bool'); return raw;
    case 'type': if (!['apartment', 'villa', 'townhouse'].includes(raw)) throw new Error('type'); return raw;
    case 'available': if (!MONTHS.includes(raw)) throw new Error('month'); return raw;
    case 'areas': case 'avoid': {
      const keys = (Array.isArray(raw) ? raw : []).filter((k) => AREAS[k]);
      if (!keys.length) throw new Error('areas');
      return [...new Set(keys)];
    }
    case 'commute': {
      if (!raw || !['DIFC', 'DIC'].includes(raw.hub)) throw new Error('hub');
      return {
        hub: raw.hub,
        to: String(raw.to || raw.hub).slice(0, 24),
        max: int(raw.max ?? 30, 5, 90),
        mode: raw.mode === 'metro' ? 'metro' : 'car',
        modeSaid: !!raw.modeSaid,
      };
    }
    default: throw new Error('field');
  }
}

// A quote must be the renter's actual words. Anything else is dropped, never shown.
function verifyQuote(q, text) {
  if (!q || typeof q !== 'string') return '';
  const t = q.trim().replace(/^["“']|["”']$/g, '');
  return t && text.toLowerCase().includes(t.toLowerCase()) ? t.slice(0, 80) : '';
}

export function normalize(raw, userText) {
  if (!raw || !Array.isArray(raw.criteria)) throw new Error('shape');
  const seen = new Set();
  const criteria = [];
  for (const c of raw.criteria) {
    if (!FIELDS.includes(c.field)) continue;
    let field = c.field, v;
    try {
      if (field === 'feature') {
        if (!FEATURES.includes(c.value)) continue;
        field = 'feature:' + c.value; v = c.value;
      } else v = value(field, c.value);
    } catch { continue; } // drop one bad item, keep the rest
    if (seen.has(field)) continue;
    seen.add(field);
    const out = {
      field, value: v,
      weight: c.weight === 'must' ? 'must' : 'nice',
      certainty: c.certainty === 'said' ? 'said' : 'assumed',
      quote: verifyQuote(c.quote, userText),
      detail: typeof c.detail === 'string' ? c.detail.slice(0, 240) : '',
    };
    // Vibes are always our translation of the renter's word, so they're always assumptions
    const VIBES = { quiet: 'I read "quiet" as away from nightlife and main roads.', lively: 'I read this as cafés and restaurants within walking distance.', beach: 'I used areas within about 10 minutes of a public beach.', schools: 'I look for at least two well-rated schools within 2 km.' };
    if (VIBES[field] || (field === 'park' && !/\d/.test(out.quote))) {
      out.certainty = 'assumed';
      if (!out.detail) out.detail = VIBES[field] || 'I read this as a park you can walk to in about 10 minutes.';
    }
    // "You said" must be provable: without the renter's own words it becomes an assumption
    if (out.certainty === 'said' && !out.quote) {
      out.certainty = 'assumed';
      if (!out.detail) out.detail = 'I inferred this from your description.';
    }
    if (field === 'beds' && c.orMore) out.orMore = true;
    if (field === 'commute') out.detail = [out.detail, 'Times are rush-hour estimates (weekday, 8:30am), shown as a range.'].filter(Boolean).join(' ');
    out.label = labelFor(out);
    criteria.push(out);
  }
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .filter((n) => ['cantcheck', 'declined', 'outofscope'].includes(n.kind) && typeof n.text === 'string' && n.text.trim())
    .slice(0, 6)
    .map((n) => ({ kind: n.kind, text: n.text.slice(0, 220), quote: verifyQuote(n.quote, userText) }));

  if (!criteria.length && !notes.length && !raw.newcomer) {
    notes.push({ kind: 'empty', quote: '', text: 'I couldn\'t pick out anything to search with. Try mentioning a budget, bedrooms, where you work, or what the area should feel like.' });
  }
  const changes = (Array.isArray(raw.changes) ? raw.changes : []).filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 80));
  return { criteria, notes, newcomer: !!raw.newcomer, changes };
}
