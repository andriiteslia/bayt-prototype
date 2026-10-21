// Scripted interpreter.
// Stands in for one LLM call with a strict JSON schema. It returns the same shape a
// production model would: criteria with certainty + the words they came from,
// things we heard but can't check, things we won't do, and what to ask next.
//
// certainty: 'said'      – taken directly from the user's words
//            'assumed'   – our translation of a vague need into something searchable
// weight:    'must' filters, 'nice' ranks

import { AREAS, AREA_ALIASES, WORKPLACES } from '../data/areas.js';

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, single: 1 };
const MONTHS = { january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', december: 'Dec' };

export const fmtAED = (n) => 'AED ' + Math.round(n).toLocaleString('en-US');
export const fmtK = (n) => Math.round(n / 1000) + 'k';

// Pull a short quote of the user's own words around a match, for "you said" provenance
function quoteAround(text, idx, len) {
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, idx - 4)) + 1);
  let end = text.indexOf(' ', Math.min(text.length, idx + len + 10));
  if (end === -1) end = text.length;
  const stop = text.slice(idx + len).search(/[.!?;,]/);
  if (stop !== -1) end = Math.min(end, idx + len + stop);
  return text.slice(start, end).replace(/[,.;]+$/, '').trim();
}

function find(re, t) {
  const m = re.exec(t);
  return m ? { m, idx: m.index } : null;
}

export function interpret(raw) {
  const text = (raw || '').trim();
  const t = text.toLowerCase();
  const criteria = [];
  const notes = [];
  const add = (c) => criteria.push({ weight: 'nice', certainty: 'said', ...c });
  const q = (hit) => (hit ? quoteAround(text, hit.idx, hit.m[0].length) : '');

  if (!t) return { criteria, notes, newcomer: false };

  // ── Out of scope ────────────────────────────────────────────────
  let h;
  if ((h = find(/\b(buy|buying|purchase|mortgage|invest(ment)?|off[- ]plan|for sale)\b/, t))) {
    notes.push({ kind: 'outofscope', quote: q(h), text: 'Buying and mortgages are outside this search. I\'m only looking at homes to rent.' });
  }

  // ── Sensitive: who lives there ──────────────────────────────────
  if ((h = find(/\b(no|without|only|avoid|not near)\s+(famil(y|ies)|kids|children|bachelors?|singles|indians?|pakistanis?|arabs?|westerners?|europeans?|asians?|africans?|russians?|locals|expats|muslims?|christians?|hindus?|jews?)\b|\b(nationalit\w*|ethnic\w*|religio\w*|race)\b/, t))) {
    notes.push({ kind: 'declined', quote: q(h), text: 'I don\'t filter homes by who lives nearby. I can look for things like quiet streets, low traffic or a gated community instead.' });
  }

  // ── Newcomer ────────────────────────────────────────────────────
  const newcomer = /\b(moving (from|to)|relocat\w*|new to (dubai|the city)|don'?t know (the city|dubai|the area|anything)|never (lived|been)|first time in dubai|arriv\w* in)\b/.test(t);

  // ── Bedrooms ────────────────────────────────────────────────────
  if ((h = find(/\bstudio\b/, t))) {
    add({ field: 'beds', value: 0, weight: 'must', label: 'Studio', quote: q(h) });
  } else if ((h = find(/\b(\d|one|two|three|four|five|single)[\s-]*(bed(room)?s?|br|bhk|b\/r)\b/, t))) {
    const n = NUM[h.m[1]] ?? parseInt(h.m[1], 10);
    add({ field: 'beds', value: n, weight: 'must', label: `${n} bedroom${n > 1 ? 's' : ''}`, quote: q(h) });
  }

  // ── Budget ──────────────────────────────────────────────────────
  const budgetRe = /(?:aed|dhs?|dirhams?)?\s*(\d{2,3}(?:[.,]\d{3})?|\d{4,6})\s*(k\b|thousand)?(?:\s*(?:aed|dhs?|dirhams?))?(?:\s*(?:\/|a|per|each)?\s*(year|yr|annum|annually|month|mo|monthly))?/g;
  let best = null, m;
  while ((m = budgetRe.exec(t))) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8);
    if (/^\s*(min|minute|bed|br|sq|km|m\b|%)/.test(after)) continue;
    if (/^\s*-?\s*(bed|br)/.test(after)) continue;
    let n = parseFloat(m[1].replace(/[.,]/g, ''));
    if (m[2]) n *= 1000;
    else if (n < 1000) continue; // bare small numbers aren't money
    const period = m[3] || '';
    const before = t.slice(Math.max(0, m.index - 30), m.index);
    const isMoney = m[2] || /aed|dhs|dirham|budget|under|below|max|up to|less than|around|about|rent|pay|afford|k\b/.test(before + m[0]) || period;
    if (!isMoney) continue;
    best = { n, period, idx: m.index, len: m[0].length, m };
  }
  if (best) {
    let yearly = best.n, certainty = 'said', detail = '';
    const monthly = /mo/.test(best.period) || (!best.period && best.n < 30000);
    if (monthly) {
      yearly = best.n * 12;
      if (!best.period) { certainty = 'assumed'; detail = `I read ${fmtK(best.n)} as per month, because yearly rents here are rarely that low.`; }
      else detail = `${fmtAED(best.n)} a month is about ${fmtAED(yearly)} a year. Most Dubai rents are quoted yearly.`;
    }
    add({ field: 'budget', value: yearly, weight: 'must', certainty, label: `Up to ${fmtK(yearly)} a year`, detail, quote: quoteAround(text, best.idx, best.len) });
  } else if ((h = find(/\b(cheap|affordable|budget[- ]friendly|not too expensive|low budget)\b/, t))) {
    add({ field: 'budget', value: 110000, weight: 'must', certainty: 'assumed', label: 'Up to 110k a year', detail: 'You didn\'t give a number, so I used AED 110k a year — below what a typical 2-bedroom costs in central areas.', quote: q(h) });
  }

  // ── Commute ─────────────────────────────────────────────────────
  let workplace = null, wHit = null;
  for (const w of WORKPLACES) { const x = find(w.re, t); if (x) { workplace = w; wHit = x; break; } }
  const minHit = find(/(\d{1,2})\s*(?:-|to)?\s*(\d{1,2})?\s*(?:min|mins|minutes)\b/, t);
  let mode = null;
  if (/\b(metro|don'?t (drive|have a car)|no car|without a car|public transport)\b/.test(t)) mode = 'metro';
  else if (/\b(drive|driving|car|commute by car)\b/.test(t)) mode = 'car';
  if (workplace) {
    const max = minHit ? parseInt(minHit.m[2] || minHit.m[1], 10) : 30;
    const modeTxt = mode === 'metro' ? 'by metro' : 'by car';
    add({
      field: 'commute', weight: minHit ? 'must' : 'nice',
      certainty: minHit && mode ? 'said' : 'assumed',
      value: { hub: workplace.hub, to: workplace.label, max, mode: mode || 'car', modeSaid: !!mode },
      label: `≤ ${max} min to ${workplace.label} ${modeTxt}`,
      detail: [
        !minHit && `You didn't say how long, so I used 30 minutes.`,
        !mode && `I assumed you'll drive. Tap to switch to metro.`,
        'Times are rush-hour estimates (weekday, 8:30am), shown as a range.',
      ].filter(Boolean).join(' '),
      quote: q(minHit && minHit.idx < wHit.idx ? minHit : wHit),
    });
  }

  // ── Pets ────────────────────────────────────────────────────────
  if ((h = find(/\b(dog|dogs|cat|cats|pet|pets|puppy)\b/, t)) && !/\bno (pets|dogs|cats)\b/.test(t)) {
    add({ field: 'pets', value: true, weight: 'must', label: 'Pets allowed', quote: q(h), detail: 'Only homes where the agent says pets are allowed, or hasn\'t said either way.' });
  }

  // ── Park ────────────────────────────────────────────────────────
  if ((h = find(/\b(park|parks|green space|greenery|walk (my|the|our) dog|dog walk\w*)\b/, t))) {
    add({ field: 'park', value: 10, certainty: 'assumed', label: 'Park within 10 min walk', quote: q(h), detail: 'You mentioned a park. I read that as one you can walk to in about 10 minutes.' });
  }

  // ── Quiet / lively ──────────────────────────────────────────────
  if ((h = find(/\b(quiet|calm|peaceful|tranquil|not noisy|no noise|away from (the )?noise)\b/, t))) {
    add({ field: 'quiet', value: true, certainty: 'assumed', label: 'Quiet', quote: q(h), detail: 'Quiet isn\'t in listing data. I used: away from nightlife and main roads, based on the building\'s position and the area.' });
  }
  if ((h = find(/\b(lively|nightlife|walkable|caf[eé]s?|restaurants|buzz\w*|social|going out)\b/, t))) {
    add({ field: 'lively', value: true, certainty: 'assumed', label: 'Lively and walkable', quote: q(h), detail: 'I used areas with cafés and restaurants you can walk to.' });
  }

  // ── Schools ─────────────────────────────────────────────────────
  if ((h = find(/\b(school|schools|kids|children|nursery)\b/, t)) && !notes.some((n) => n.kind === 'declined')) {
    add({ field: 'schools', value: 2, certainty: 'assumed', label: 'Good schools nearby', quote: q(h), detail: 'I look for at least two schools with a "Good" or better inspection rating within 2 km (fictional ratings in this demo).' });
    notes.push({ kind: 'cantcheck', quote: q(h), text: 'Whether a school has places, or suits your child. Ratings tell you about the school, not about fit.' });
  }

  // ── Metro ───────────────────────────────────────────────────────
  if ((h = find(/\b(near|close to|walk to|next to|by) (the )?metro\b|\bmetro (station|stop)\b/, t))) {
    add({ field: 'metro', value: 10, weight: 'nice', label: 'Metro within 10 min walk', quote: q(h) });
  }

  // ── Property type ───────────────────────────────────────────────
  if ((h = find(/\b(villa|townhouse|town house|apartment|flat)\b/, t))) {
    const v = /town ?house/.test(h.m[1]) ? 'townhouse' : h.m[1] === 'flat' ? 'apartment' : h.m[1];
    add({ field: 'type', value: v, weight: 'must', label: v[0].toUpperCase() + v.slice(1), quote: q(h) });
  }

  // ── Furnished ───────────────────────────────────────────────────
  if ((h = find(/\b(unfurnished|furnished)\b/, t))) {
    const v = h.m[1] === 'furnished';
    add({ field: 'furnished', value: v, weight: 'must', label: v ? 'Furnished' : 'Unfurnished', quote: q(h) });
  }

  // ── Size ────────────────────────────────────────────────────────
  if ((h = find(/\b(big|spacious|large|lots of space|roomy)\b/, t))) {
    add({ field: 'size', value: 1200, certainty: 'assumed', label: '1,200+ sq ft', quote: q(h), detail: 'I read "spacious" as at least 1,200 sq ft. Tap to change.' });
  }

  // ── Beach ───────────────────────────────────────────────────────
  if ((h = find(/\b(beach|seaside|sea)\b/, t))) {
    add({ field: 'beach', value: true, certainty: 'assumed', label: 'Close to the beach', quote: q(h), detail: 'I used areas within about 10 minutes of a public beach.' });
  }

  // ── Amenities ───────────────────────────────────────────────────
  for (const [f, re] of [['pool', /\b(pool|swimming)\b/], ['gym', /\bgym\b/], ['balcony', /\b(balcony|terrace)\b/], ['garden', /\b(garden|yard)\b/], ['parking', /\b(parking|car space)\b/]]) {
    if ((h = find(re, t))) add({ field: 'feature:' + f, value: f, label: f[0].toUpperCase() + f.slice(1), quote: q(h) });
  }

  // ── Move date ───────────────────────────────────────────────────
  if ((h = find(/\b(january|february|march|april|may|december)\b/, t))) {
    const v = MONTHS[h.m[1]];
    add({ field: 'available', value: v, label: `Move in ${h.m[1][0].toUpperCase() + h.m[1].slice(1)}`, quote: q(h), detail: 'Homes free now may not be held for you. I flag that on each home.' });
  }

  // ── Areas: wanted / avoided ─────────────────────────────────────
  const want = [], avoid = [];
  for (const [key, re] of AREA_ALIASES) {
    const x = find(re, t);
    if (!x) continue;
    if (workplace && wHit && x.idx >= wHit.idx && x.idx <= wHit.idx + wHit.m[0].length) continue; // the workplace itself
    const before = t.slice(Math.max(0, x.idx - 18), x.idx);
    if (/\b(not|avoid|no|except|anywhere but|hate)\b[^.]*$/.test(before)) avoid.push({ key, x });
    else if (!(workplace && new RegExp(`(work|office|job)[^.]{0,30}$`).test(before))) want.push({ key, x });
  }
  if (want.length) add({ field: 'areas', value: want.map((a) => a.key), weight: 'must', label: want.map((a) => AREAS[a.key].name.replace(/ \(.*\)/, '')).join(', '), quote: q(want[0].x) });
  if (avoid.length) add({ field: 'avoid', value: avoid.map((a) => a.key), weight: 'must', label: 'Not ' + avoid.map((a) => AREAS[a.key].name.replace(/ \(.*\)/, '')).join(', '), quote: q(avoid[0].x) });

  // ── Heard but can't check ───────────────────────────────────────
  const cant = [
    [/\b(safe|safety|secure)\b/, 'Safety. I don\'t rank areas by safety; there\'s no reliable street-level data I could stand behind.'],
    [/\b(nice|friendly|good) neighbou?rs?\b|\bneighbou?rs\b/, 'Nice neighbours. Nothing in a listing can tell us that.'],
    [/\b(natural light|sunlight|sunny|bright)\b/, 'Natural light. Agents rarely state it. Ask which way the windows face.'],
    [/\b(vibe|community feel|sense of community)\b/, 'The feel of a community. The area notes on each home are my best short description.'],
    [/\b(no construction|construction)\b/, 'Nearby construction. Listings don\'t report it reliably. Worth asking the agent.'],
    [/\b(sea view|view of|nice view|good view|views?)\b/, 'Views. I can\'t see them; only photos and a viewing can confirm them.'],
  ];
  for (const [re, txt] of cant) if ((h = find(re, t))) notes.push({ kind: 'cantcheck', quote: q(h), text: txt });

  if (!criteria.length && !notes.length && !newcomer) {
    notes.push({ kind: 'empty', quote: text.slice(0, 40), text: 'I couldn\'t pick out anything to search with. Try mentioning a budget, bedrooms, where you work, or what the area should feel like.' });
  }

  return { criteria, notes, newcomer, workplace };
}

// ── Refinement: merge a follow-up message into the current understanding ──
const FIELD_WORDS = [
  ['quiet', /\bquiet\w*|\bnoise\b/], ['park', /\bparks?\b/], ['pets', /\b(pets?|dogs?|cats?)\b/],
  ['metro', /\bmetro\b/], ['schools', /\bschools?\b/], ['budget', /\b(budget|price|rent|cost)\b/],
  ['beds', /\bbed(room)?s?\b/], ['commute', /\b(commute|drive|driving|travel time)\b/],
  ['furnished', /\bfurnish\w*\b/], ['lively', /\b(lively|nightlife|walkable)\b/], ['beach', /\bbeach\b/],
  ['size', /\b(size|space|sq ?ft)\b/], ['areas', /\b(area|areas|neighbou?rhoods?)\b/],
];

export function refine(current, rawText) {
  const t = rawText.toLowerCase();
  let criteria = [...current.criteria];
  let notes = [...current.notes];
  const changes = [];

  // Remove / relax / tighten by keyword
  const removing = /\b(forget|remove|drop|don'?t (care|need|mind)|no longer|skip|ignore)\b/.test(t);
  const relaxing = /\b(flexible|not important|nice to have|doesn'?t matter as much|optional)\b/.test(t);
  const tightening = /\b(must|has to|have to|essential|non-negotiable|really need)\b/.test(t);
  if (removing || relaxing || tightening) {
    for (const [field, re] of FIELD_WORDS) {
      if (!re.test(t)) continue;
      const i = criteria.findIndex((c) => c.field === field);
      if (i === -1) continue;
      if (removing) { changes.push(`Removed "${criteria[i].label}"`); criteria.splice(i, 1); }
      else if (relaxing) { criteria[i] = { ...criteria[i], weight: 'nice' }; changes.push(`"${criteria[i].label}" is now nice to have`); }
      else { criteria[i] = { ...criteria[i], weight: 'must' }; changes.push(`"${criteria[i].label}" is now a must`); }
    }
  }

  // Anything new or updated
  const next = interpret(rawText);
  for (const c of next.criteria) {
    if (removing && FIELD_WORDS.some(([f, re]) => f === c.field && re.test(t))) continue;
    const i = criteria.findIndex((x) => x.field === c.field);
    if (i >= 0) {
      const merged = { ...c, weight: criteria[i].weight === 'must' || c.weight === 'must' ? 'must' : 'nice' };
      if (c.field === 'commute' && !c.value.modeSaid) merged.value = { ...c.value, mode: criteria[i].value.mode, modeSaid: criteria[i].value.modeSaid };
      criteria[i] = merged; changes.push(`Updated "${c.label}"`);
    } else { criteria.push(c); changes.push(`Added "${c.label}"`); }
  }
  for (const n of next.notes) {
    if (n.kind === 'empty') continue;
    if (!notes.some((x) => x.text === n.text)) notes.push(n);
  }
  return { ...current, criteria, notes, newcomer: current.newcomer || next.newcomer, changes };
}

// ── Clarifying questions: only for what changes the result most ──
export function questionsFor(u) {
  const has = (f) => u.criteria.some((c) => c.field === f);
  const qs = [];
  const missingCore = ['budget', 'beds'].filter((f) => !has(f)).length;
  if (!(u.newcomer || missingCore >= 2)) return qs;
  if (!has('budget')) qs.push({
    id: 'budget', title: 'What can you spend a year?', why: 'Rent here is paid yearly, often in 1–4 cheques.',
    options: [
      { label: 'Up to 100k', value: 100000 }, { label: 'Up to 130k', value: 130000 },
      { label: 'Up to 160k', value: 160000 }, { label: 'Up to 220k', value: 220000 },
    ],
  });
  if (!has('beds')) qs.push({
    id: 'beds', title: 'How many bedrooms?', why: '',
    options: [{ label: 'Studio', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3+', value: 3 }],
  });
  const commute = u.criteria.find((c) => c.field === 'commute');
  if (commute && !commute.value.modeSaid) qs.push({
    id: 'mode', title: `How will you get to ${commute.value.to}?`, why: 'This changes which areas make sense more than anything else.',
    options: [{ label: 'Driving', value: 'car' }, { label: 'Metro', value: 'metro' }],
  });
  return qs.slice(0, 3);
}

export function applyAnswer(u, qid, value, label) {
  const criteria = [...u.criteria];
  if (qid === 'budget') criteria.push({ field: 'budget', value, weight: 'must', certainty: 'said', label: `Up to ${fmtK(value)} a year`, quote: 'your answer' });
  if (qid === 'beds') criteria.push({ field: 'beds', value, orMore: value === 3, weight: 'must', certainty: 'said', label: value === 0 ? 'Studio' : `${value}${value === 3 ? '+' : ''} bedroom${value > 1 ? 's' : ''}`, quote: 'your answer' });
  if (qid === 'mode') {
    const i = criteria.findIndex((c) => c.field === 'commute');
    const c = criteria[i];
    const v = { ...c.value, mode: value, modeSaid: true };
    criteria[i] = { ...c, value: v, label: `≤ ${v.max} min to ${v.to} by ${value === 'metro' ? 'metro' : 'car'}`, detail: (c.detail || '').replace(/I assumed you'll drive\. Tap to switch to metro\. ?/, '') };
  }
  return { ...u, criteria };
}
