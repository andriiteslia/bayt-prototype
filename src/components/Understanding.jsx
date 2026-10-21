import { useState } from 'react';
import { Icon, Sheet, Seg } from './ui.jsx';
import { AREAS } from '../data/areas.js';
import { fmtK } from '../lib/interpret.js';

export const CERTAINTY = {
  said: { label: 'You said', hint: 'Taken from your words' },
  assumed: { label: 'I assumed', hint: 'My reading of what you meant. Check it.' },
  confirmed: { label: 'Confirmed', hint: 'You checked this' },
};

export function Chip({ c, onClick, flash }) {
  return (
    <button className={`chip chip-${c.certainty} ${flash ? 'flash' : ''}`} onClick={onClick}
      aria-label={`${c.label}. ${CERTAINTY[c.certainty].label}. ${c.weight === 'must' ? 'Must have' : 'Nice to have'}. Tap to change.`}>
      {c.certainty === 'assumed' && <span className="chip-q" aria-hidden>?</span>}
      {c.label}
    </button>
  );
}

// The same understanding, shown as the filter form people already know from property portals.
// Rows a typical portal has, in the order they usually appear.
const FILTER_ROWS = [
  { field: 'budget', label: 'Price', value: (c) => `Up to AED ${c.value.toLocaleString('en-US')} / year` },
  { field: 'beds', label: 'Bedrooms', value: (c) => (c.value === 0 ? 'Studio' : `${c.value}${c.orMore ? '+' : ''}`) },
  { field: 'type', label: 'Property type', value: (c) => c.value[0].toUpperCase() + c.value.slice(1) },
  { field: 'areas', label: 'Location', value: (c) => c.label },
  { field: 'furnished', label: 'Furnishing', value: (c) => (c.value ? 'Furnished' : 'Unfurnished') },
  { field: 'size', label: 'Size', value: (c) => `${c.value.toLocaleString()}+ sq ft` },
  { field: 'available', label: 'Available from', value: (c) => c.label.replace('Move in ', '') },
];
const AMENITY = (c) => c.field === 'pets' || c.field.startsWith('feature:');
// Things people say that portals have no filter for
const NO_FILTER = ['commute', 'quiet', 'park', 'lively', 'schools', 'beach', 'metro', 'avoid'];
export const ADDABLE = { budget: true, beds: true };

function FiltersView({ u, onChip, onAdd, flashKeys }) {
  const idx = (f) => u.criteria.findIndex((c) => c.field === f);
  const amen = u.criteria.map((c, i) => [c, i]).filter(([c]) => AMENITY(c));
  const extra = u.criteria.map((c, i) => [c, i]).filter(([c]) => NO_FILTER.includes(c.field));
  const cant = u.notes.filter((n) => n.kind === 'cantcheck').length;
  const covered = u.criteria.length - extra.length;
  const words = u.criteria.length + cant;

  return (
    <div className="fv">
      {words > 0 && (
        <p className="fv-sum">
          {extra.length + cant > 0
            ? <><strong>{extra.length + cant} of your {words} wishes</strong> have no filter on a typical portal. {covered > 0 ? `The other ${covered} map to the filters below.` : ''}</>
            : <>Everything you said maps to standard filters.</>}
        </p>
      )}
      <ul className="fv-list">
        {FILTER_ROWS.map((r) => {
          const i = idx(r.field);
          const c = u.criteria[i];
          const can = c || ADDABLE[r.field];
          return (
            <li key={r.field}>
              <button className={`fv-row ${c ? 'set' : ''} ${c && flashKeys.includes(c.field) ? 'flash' : ''}`} disabled={!can}
                onClick={() => (c ? onChip(i) : onAdd(r.field))}>
                <span className="fv-l">{r.label}</span>
                <span className="fv-v">{c ? <>{c.certainty === 'assumed' && <span className="chip-q" aria-label="Assumed">?</span>}{r.value(c)}</> : 'Any'}</span>
              </button>
            </li>
          );
        })}
        <li>
          <div className={`fv-row ${amen.length ? 'set' : ''}`}>
            <span className="fv-l">Amenities</span>
            <span className="fv-v fv-tags">
              {amen.length ? amen.map(([c, i]) => <button key={i} onClick={() => onChip(i)}>{c.label}</button>) : 'Any'}
            </span>
          </div>
        </li>
      </ul>

      {extra.length > 0 && (
        <div className="fv-extra">
          <h4>Only possible by describing it</h4>
          <ul className="fv-list">
            {extra.map(([c, i]) => (
              <li key={i}>
                <button className={`fv-row set nofilter ${flashKeys.includes(c.field) ? 'flash' : ''}`} onClick={() => onChip(i)}>
                  <span className="fv-v">{c.certainty === 'assumed' && <span className="chip-q" aria-label="Assumed">?</span>}{c.label}</span>
                  <span className="fv-tag">No filter</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function UnderstandingCard({ u, query, onEditText, onChip, onLegend, onAdd, mode, setMode, flashKeys = [] }) {
  const must = u.criteria.map((c, i) => [c, i]).filter(([c]) => c.weight === 'must');
  const nice = u.criteria.map((c, i) => [c, i]).filter(([c]) => c.weight === 'nice');
  const cant = u.notes.filter((n) => n.kind === 'cantcheck');
  const declined = u.notes.filter((n) => n.kind === 'declined' || n.kind === 'outofscope');
  const assumedCount = u.criteria.filter((c) => c.certainty === 'assumed').length;

  return (
    <section className="understand" aria-labelledby="u-title">
      <div className="u-quote">
        <p>“{query}”</p>
        <button className="link" onClick={onEditText}><Icon.pencil /> Edit</button>
      </div>
      {u.source === 'ai' && <p className="src-line ai"><span className="dot" />Read by AI{u.ms ? ` in ${(u.ms / 1000).toFixed(1)} s` : ''}</p>}
      {u.source === 'example' && <p className="src-line">Guided example: a fixed reading, so it behaves the same every time. Type your own to use the live AI.</p>}
      {u.source === 'basic' && (
        <div className="notice notice-basic">
          <Icon.info />
          <div><strong>Basic reading</strong><p>The AI didn't respond, so I matched keywords instead. It misses more than usual. Check each item.</p></div>
        </div>
      )}

      <div className="u-head">
        <h2 id="u-title">What I understood</h2>
        {u.criteria.length > 0 && (
          <div className="mini-seg" role="radiogroup" aria-label="Show as">
            <button role="radio" aria-checked={mode === 'words'} className={mode === 'words' ? 'on' : ''} onClick={() => setMode('words')}>Words</button>
            <button role="radio" aria-checked={mode === 'filters'} className={mode === 'filters' ? 'on' : ''} onClick={() => setMode('filters')}>Filters</button>
          </div>
        )}
      </div>
      {mode === 'filters' ? (
        <FiltersView u={u} onChip={onChip} onAdd={onAdd} flashKeys={flashKeys} />
      ) : <>
      {assumedCount > 0 && (
        <p className="u-sub">{assumedCount === 1 ? 'One thing is' : `${assumedCount} things are`} my guess — marked with a dashed line. Tap any of them to fix.</p>
      )}

      {declined.map((n, i) => (
        <div key={'d' + i} className={`notice notice-${n.kind}`}>
          <Icon.stop />
          <div><strong>{n.kind === 'declined' ? 'Not something I filter by' : 'Outside this search'}</strong><p>{n.text}</p></div>
        </div>
      ))}

      {must.length > 0 && (
        <div className="u-group">
          <h4>Must have <span>hides homes that don't fit</span></h4>
          <div className="chips">{must.map(([c, i]) => <Chip key={i} c={c} onClick={() => onChip(i)} flash={flashKeys.includes(c.field)} />)}</div>
        </div>
      )}
      {nice.length > 0 && (
        <div className="u-group">
          <h4>Nice to have <span>changes the order</span></h4>
          <div className="chips">{nice.map(([c, i]) => <Chip key={i} c={c} onClick={() => onChip(i)} flash={flashKeys.includes(c.field)} />)}</div>
        </div>
      )}

      {cant.length > 0 && (
        <div className="u-group">
          <h4>Heard, but can't check</h4>
          <ul className="cant">
            {cant.map((n, i) => <li key={i}><span className="cant-dot" aria-hidden />{n.text}</li>)}
          </ul>
        </div>
      )}
      </>}
      <button className="link small u-legend" onClick={onLegend}><Icon.info /> How to read this</button>
    </section>
  );
}

export function LegendSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="How to read this">
      <div className="legend">
        <div className="legend-row"><span className="chip chip-said">2 bedrooms</span><p><strong>You said it.</strong> Taken straight from your words.</p></div>
        <div className="legend-row"><span className="chip chip-assumed"><span className="chip-q">?</span>Quiet</span><p><strong>I assumed it.</strong> I turned something vague into something I can search. Tap to see how, and fix it.</p></div>
        <div className="legend-row"><span className="cant-dot big" /><p><strong>Can't check.</strong> I heard it, but there's no data I'd trust. I won't pretend otherwise.</p></div>
      </div>
      <h4 className="sheet-h">Must have vs nice to have</h4>
      <p className="muted">Must-haves hide homes that don't fit. Nice-to-haves only change the order. Tap any item to move it.</p>
      <h4 className="sheet-h">Where facts come from</h4>
      <p className="muted"><span className="src src-agent">Agent</span> stated in the listing. <span className="src src-estimate">Estimate</span> worked out by Bayt from location data — a range, not a promise.</p>
      <h4 className="sheet-h">About this demo</h4>
      <p className="muted">28 fictional homes. The reading of your words is scripted, so unusual phrasing may be missed — which is why everything here is editable.</p>
    </Sheet>
  );
}

const relabel = (c) => {
  switch (c.field) {
    case 'budget': return `Up to ${fmtK(c.value)} a year`;
    case 'beds': return c.value === 0 ? 'Studio' : `${c.value}${c.orMore ? '+' : ''} bedroom${c.value > 1 ? 's' : ''}`;
    case 'commute': return `≤ ${c.value.max} min to ${c.value.to} by ${c.value.mode === 'metro' ? 'metro' : 'car'}`;
    case 'park': return `Park within ${c.value} min walk`;
    case 'metro': return `Metro within ${c.value} min walk`;
    case 'size': return `${c.value.toLocaleString()}+ sq ft`;
    case 'areas': return c.value.map((k) => AREAS[k].name.replace(/ \(.*\)/, '')).join(', ');
    case 'avoid': return 'Not ' + c.value.map((k) => AREAS[k].name.replace(/ \(.*\)/, '')).join(', ');
    default: return c.label;
  }
};

export function EditSheet({ c, isNew, onClose, onSave, onRemove }) {
  const [d, setD] = useState(c);
  if (!c) return null;
  const set = (patch) => setD((x) => {
    const n = { ...x, ...patch };
    return { ...n, label: relabel(n) };
  });
  const setV = (v) => set({ value: v });
  const changed = JSON.stringify(d) !== JSON.stringify(c);

  return (
    <Sheet open onClose={onClose} title={d.label}
      footer={
        <>
          <button className="btn ghost danger" onClick={isNew ? onClose : onRemove}>{isNew ? 'Cancel' : 'Remove'}</button>
          {isNew
            ? <button className="btn primary" onClick={() => onSave(d)}>Add filter</button>
            : c.certainty === 'assumed' && !changed
            ? <button className="btn primary" onClick={() => onSave({ ...d, certainty: 'confirmed' })}>Yes, that's right</button>
            : <button className="btn primary" onClick={() => onSave(changed ? { ...d, certainty: 'confirmed' } : d)} disabled={!changed}>Update results</button>}
        </>
      }>
      {!isNew && <div className={`prov prov-${c.certainty}`}>
        <span className="prov-tag">{CERTAINTY[c.certainty].label}</span>
        {c.quote && <p>From your words: <q>{c.quote}</q></p>}
      </div>}
      {c.detail && <p className="muted">{c.detail}</p>}

      <Controls d={d} set={set} setV={setV} />

      <h4 className="sheet-h">How much does it matter?</h4>
      <Seg label="Importance" value={d.weight} onChange={(w) => set({ weight: w })}
        options={[{ label: 'Must have', value: 'must' }, { label: 'Nice to have', value: 'nice' }]} />
      <p className="muted small">{d.weight === 'must' ? 'Homes that don\'t fit are hidden.' : 'Homes that fit move up the list. Nothing is hidden.'}</p>
    </Sheet>
  );
}

function Controls({ d, set, setV }) {
  switch (d.field) {
    case 'budget':
      return (
        <div className="ctl">
          <div className="stepper">
            <button onClick={() => setV(Math.max(40000, d.value - 10000))} aria-label="Lower by 10k">−</button>
            <div><strong>AED {Math.round(d.value / 1000)}k</strong><span>a year · about {Math.round(d.value / 12000)}k a month</span></div>
            <button onClick={() => setV(d.value + 10000)} aria-label="Raise by 10k">+</button>
          </div>
        </div>
      );
    case 'beds':
      return <div className="ctl"><Seg label="Bedrooms" value={d.value} onChange={(v) => set({ value: v, orMore: v === 3 && d.orMore })}
        options={[{ label: 'Studio', value: 0 }, { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }]} /></div>;
    case 'commute':
      return (
        <div className="ctl">
          <label className="ctl-l">At most</label>
          <Seg label="Minutes" value={d.value.max} onChange={(v) => setV({ ...d.value, max: v })}
            options={[15, 20, 25, 30, 40, 45].map((m) => ({ label: `${m}`, value: m }))} />
          <label className="ctl-l">Getting there</label>
          <Seg label="Mode" value={d.value.mode} onChange={(v) => setV({ ...d.value, mode: v, modeSaid: true })}
            options={[{ label: 'Driving', value: 'car' }, { label: 'Metro', value: 'metro' }]} />
          <p className="muted small">Rush hour, weekday 8:30am. Shown as a range, because Dubai traffic varies a lot.</p>
        </div>
      );
    case 'park': case 'metro':
      return <div className="ctl"><label className="ctl-l">Walking minutes</label><Seg label="Minutes" value={d.value} onChange={setV}
        options={[5, 10, 15].map((m) => ({ label: `${m} min`, value: m }))} /></div>;
    case 'size':
      return <div className="ctl"><Seg label="Size" value={d.value} onChange={setV}
        options={[900, 1200, 1500, 2000].map((m) => ({ label: `${m.toLocaleString()}+`, value: m }))} /></div>;
    case 'areas': case 'avoid':
      return (
        <div className="ctl area-pick">
          {Object.entries(AREAS).map(([k, a]) => {
            const on = d.value.includes(k);
            return <button key={k} className={on ? 'on' : ''} aria-pressed={on}
              onClick={() => setV(on ? d.value.filter((x) => x !== k) : [...d.value, k])}>{a.name.replace(/ \(.*\)/, '')}</button>;
          })}
        </div>
      );
    default: return null;
  }
}

export function Questions({ qs, answers, onAnswer, onSkip }) {
  const pending = qs.filter((q) => !(q.id in answers));
  return (
    <section className="questions" aria-labelledby="q-title">
      <h2 id="q-title">{qs.length === 1 ? 'One quick question' : `${qs.length} quick questions`}</h2>
      <p className="u-sub">They change your results the most. Skip any you're unsure about.</p>
      {qs.map((q) => (
        <div key={q.id} className={`q ${q.id in answers ? 'done' : ''}`}>
          <p className="q-title">{q.title}</p>
          {q.why && <p className="muted small">{q.why}</p>}
          <div className="q-opts">
            {q.options.map((o) => (
              <button key={o.label} className={answers[q.id] === o.label ? 'on' : ''}
                onClick={() => onAnswer(q, o)} disabled={q.id in answers}>{o.label}</button>
            ))}
          </div>
        </div>
      ))}
      {pending.length > 0 && <button className="btn ghost wide" onClick={onSkip}>Skip and show homes</button>}
    </section>
  );
}
