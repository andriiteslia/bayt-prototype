// Matching runs on our own listing data, never on model output.
// Each criterion is checked per home and returns a status the UI can explain.
import { AREAS } from '../data/areas.js';
import { LISTINGS, AVAILABILITY } from '../data/listings.js';
import { fmtAED, fmtK } from './interpret.js';

const R = (status, text, source = 'agent') => ({ status, text, source });

export function evaluate(c, l) {
  const a = AREAS[l.area];
  switch (c.field) {
    case 'beds': {
      const label = (n) => (n === 0 ? 'Studio' : `${n} bedroom${n > 1 ? 's' : ''}`);
      if (l.beds === c.value || (c.orMore && l.beds >= c.value)) return R('match', label(l.beds));
      if (l.beds === c.value + 1) return R('partial', `${label(l.beds)} — one more than you asked`);
      return R('miss', `${label(l.beds)}, you asked for ${c.value === 0 ? 'a studio' : c.value}`);
    }
    case 'budget': {
      if (l.rent <= c.value) return R('match', `${fmtAED(l.rent)} a year, within budget`);
      const over = l.rent - c.value;
      if (l.rent <= c.value * 1.07) return R('partial', `${fmtK(over)} over your budget`);
      return R('miss', `${fmtK(over)} over your budget`);
    }
    case 'commute': {
      const { hub, to, max, mode } = c.value;
      if (mode === 'metro') {
        const m = a.metro[hub];
        if (m == null) return R('miss', `No practical metro route to ${to}`, 'estimate');
        if (m <= max) return R('match', `About ${m} min to ${to} by metro`, 'estimate');
        if (m <= max + 7) return R('partial', `About ${m} min to ${to} by metro`, 'estimate');
        return R('miss', `About ${m} min to ${to} by metro`, 'estimate');
      }
      const [lo, hi] = a.drive[hub];
      const txt = `${lo}–${hi} min drive to ${to} at rush hour`;
      if (hi <= max) return R('match', txt, 'estimate');
      if (lo <= max) return R('partial', `${txt} — over ${max} on bad days`, 'estimate');
      return R('miss', txt, 'estimate');
    }
    case 'pets':
      if (l.pets === 'allowed') return R('match', 'Pets allowed');
      if (l.pets === 'no') return R('miss', 'No pets');
      return R('unknown', 'Pets not stated — ask the agent');
    case 'park':
      if (l.parkWalk == null) return R('unknown', 'No park distance listed', 'estimate');
      if (l.parkWalk <= c.value) return R('match', `Park ${l.parkWalk} min walk`, 'estimate');
      if (l.parkWalk <= c.value + 5) return R('partial', `Park ${l.parkWalk} min walk`, 'estimate');
      return R('miss', `Nearest park ${l.parkWalk} min walk`, 'estimate');
    case 'quiet':
      return l.quiet ? R('match', l.quietNote, 'estimate') : R('miss', l.quietNote, 'estimate');
    case 'lively':
      return a.lively ? R('match', 'Cafés and restaurants nearby', 'estimate') : R('miss', 'Mostly residential, little nightlife', 'estimate');
    case 'schools':
      if (l.schools >= c.value) return R('match', `${l.schools} well-rated schools within 2 km`, 'estimate');
      if (l.schools === 1) return R('partial', '1 well-rated school within 2 km', 'estimate');
      return R('miss', 'No well-rated schools within 2 km', 'estimate');
    case 'metro':
      if (l.metroWalk == null) return R('miss', 'No metro within walking distance', 'estimate');
      if (l.metroWalk <= c.value) return R('match', `Metro ${l.metroWalk} min walk`, 'estimate');
      if (l.metroWalk <= c.value + 5) return R('partial', `Metro ${l.metroWalk} min walk`, 'estimate');
      return R('miss', `Metro ${l.metroWalk} min walk`, 'estimate');
    case 'type':
      return l.type === c.value ? R('match', cap(l.type)) : R('miss', `${cap(l.type)}, not a ${c.value}`);
    case 'furnished':
      if (l.furnished == null) return R('unknown', 'Furnishing not stated');
      return l.furnished === c.value ? R('match', l.furnished ? 'Furnished' : 'Unfurnished') : R('miss', l.furnished ? 'Furnished' : 'Unfurnished');
    case 'size':
      if (l.sqft >= c.value) return R('match', `${l.sqft.toLocaleString()} sq ft`);
      if (l.sqft >= c.value * 0.9) return R('partial', `${l.sqft.toLocaleString()} sq ft`);
      return R('miss', `${l.sqft.toLocaleString()} sq ft`);
    case 'beach':
      return a.beach ? R('match', 'A few minutes from the beach', 'estimate') : R('miss', 'Not near the beach', 'estimate');
    case 'areas':
      return c.value.includes(l.area) ? R('match', `In ${a.name}`) : R('miss', `In ${a.name}`);
    case 'avoid':
      return c.value.includes(l.area) ? R('miss', `In ${a.name}`) : R('match', `Not in ${c.label.replace(/^Not /, '')}`);
    case 'available': {
      const want = AVAILABILITY.indexOf(c.value), has = AVAILABILITY.indexOf(l.available);
      const when = l.available === 'Now' ? 'Available now' : `Available from ${l.available}`;
      if (has === want || has === want - 1) return R('match', when);
      if (has < want) return R('partial', `${when} — may not be held until ${c.value}`);
      return R('miss', `${when}, after your move`);
    }
    default:
      if (c.field.startsWith('feature:')) return l.features.includes(c.value) ? R('match', cap(c.value)) : R('miss', `No ${c.value} listed`);
      return R('unknown', '');
  }
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SCORE = { match: 2, partial: 1, unknown: 0.6, miss: 0 };

export function scoreListing(criteria, l) {
  const evals = criteria.map((c) => ({ c, r: evaluate(c, l) }));
  const must = evals.filter((e) => e.c.weight === 'must');
  return {
    listing: l, area: AREAS[l.area], evals,
    mustMiss: must.filter((e) => e.r.status === 'miss').length,
    mustPartial: must.filter((e) => e.r.status === 'partial').length,
    score: evals.reduce((s, e) => s + SCORE[e.r.status] * (e.c.weight === 'must' ? 1.5 : 1), 0) + (l.verified ? 0.3 : 0),
  };
}

export function search(criteria, hidden = []) {
  const pool = LISTINGS.filter((l) => !hidden.includes(l.id));
  const scored = pool.map((l) => scoreListing(criteria, l)).sort((a, b) => b.score - a.score || a.listing.rent - b.listing.rent);
  const fits = scored.filter((s) => s.mustMiss === 0 && s.mustPartial === 0);
  const close = scored.filter((s) => s.mustMiss === 0 && s.mustPartial === 1);
  return { fits, close, scored, checked: pool.length };
}

// When nothing fits: which single must-have, if made flexible, unlocks the most homes
export function relaxations(criteria, hidden = []) {
  const out = [];
  criteria.forEach((c, i) => {
    if (c.weight !== 'must') return;
    const relaxed = criteria.map((x, j) => (j === i ? { ...x, weight: 'nice' } : x));
    const r = search(relaxed, hidden);
    out.push({ index: i, c, count: r.fits.length + r.close.length });
  });
  return out.sort((a, b) => b.count - a.count);
}

// "Homes that match everything else start at…" – a concrete number for budget conflicts
export function budgetFloor(criteria, hidden = []) {
  const b = criteria.find((c) => c.field === 'budget' && c.weight === 'must');
  if (!b) return null;
  const others = criteria.filter((c) => c !== b);
  const r = search(others, hidden);
  const pool = [...r.fits, ...r.close];
  if (!pool.length) return null;
  return Math.min(...pool.map((s) => s.listing.rent));
}
