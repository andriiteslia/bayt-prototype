import { useEffect, useMemo, useRef, useState } from 'react';
import { interpret, refine, questionsFor, applyAnswer, fmtAED, fmtK } from './lib/interpret.js';
import { search, relaxations, budgetFloor, scoreListing } from './lib/match.js';
import { LISTINGS } from './data/listings.js';
import { AREAS } from './data/areas.js';
import { Icon } from './components/ui.jsx';
import { UnderstandingCard, LegendSheet, EditSheet, Questions } from './components/Understanding.jsx';
import { ListingCard, Detail, MessageSheet, NotForMeSheet } from './components/Listing.jsx';
import { Photo } from './components/Photo.jsx';
import { NotesPanel } from './components/Notes.jsx';
import { readWithAI } from './lib/ai.js';
import Device from './components/Device.jsx';

const EXAMPLES = [
  { icon: 'plane', title: 'New to Dubai', text: "I'm moving from London in March for a job in DIFC and don't know the city at all. We have a dog." },
  { icon: 'clock', title: 'Quiet, short drive', text: "Somewhere quiet, 2 bedrooms, under 140k. I don't want to drive more than 25 minutes to DIFC, and a park I can walk my dog to." },
  { icon: 'wallet', title: 'Big wish, small budget', text: '3 bedroom in Downtown under 90k' },
  { icon: 'eye', title: "Things I can't check", text: 'A safe area with nice neighbours, no families with kids, 1 bedroom near the metro under 110k' },
];

const REFINE_HINTS = ['near the metro', 'flexible on budget', 'forget the park', 'actually 3 bedrooms'];

export default function App() {
  const [view, setView] = useState('describe'); // describe | results | saved
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [u, setU] = useState(null);
  const [answers, setAnswers] = useState({});
  const [skipped, setSkipped] = useState(false);
  const [hidden, setHidden] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [sheet, setSheet] = useState(null); // {type, ...}
  const [toast, setToast] = useState(null); // {text, undo}
  const [flash, setFlash] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState('best');
  const [uMode, setUMode] = useState('words');
  const [uOpen, setUOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  const [qs, setQs] = useState([]); // asked once per description, never re-asked after edits
  const pendingQs = qs.filter((q) => !(q.id in answers));
  const askFirst = qs.length > 0 && pendingQs.length > 0 && !skipped;
  const isEmpty = u && u.notes.some((n) => n.kind === 'empty') && !u.criteria.length;

  const res = useMemo(() => (u ? search(u.criteria, hidden) : null), [u, hidden]);
  const zero = res && !res.fits.length && !res.close.length;

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5200); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { if (flash.length) { const t = setTimeout(() => setFlash([]), 1600); return () => clearTimeout(t); } }, [flash]);

  const reqId = useRef(0);
  async function submit(text, { example = false } = {}) {
    const t = text.trim();
    if (!t) return;
    const id = ++reqId.current;
    setQuery(t); setLoading(true); setView('results'); setAnswers({}); setSkipped(false); setHidden([]); setShowAll(false); setUMode('words');
    scrollRef.current?.scrollTo(0, 0);
    let nu;
    if (example) {
      // Guided scenarios use a fixed reading so they behave the same for every reviewer
      await new Promise((r) => setTimeout(r, 900));
      nu = { ...interpret(t), source: 'example' };
    } else {
      const started = Date.now();
      const ai = await readWithAI(t);
      if (ai?.understanding) nu = { ...ai.understanding, source: 'ai', ms: ai.ms };
      else {
        nu = { ...interpret(t), source: 'basic', failed: ai?.failed };
        const wait = 700 - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    }
    if (id !== reqId.current) return; // a newer search started
    // Start collapsed so results show first, unless the reading needs attention
    setUOpen(nu.source === 'basic' || nu.notes.some((n) => ['declined', 'outofscope', 'empty'].includes(n.kind)));
    setU(nu); setQs(questionsFor(nu)); setLoading(false);
  }

  function tryScenario(text) {
    setDetailId(null); setSheet(null); setDraft(text); submit(text, { example: true });
  }

  function snapshot() { return { u, hidden }; }
  function restore(s) { setU(s.u); setHidden(s.hidden); }

  const [busy, setBusy] = useState(false);
  async function onRefine(text) {
    const before = snapshot();
    let next = null;
    if (u.source !== 'basic') {
      setBusy(true);
      const ai = await readWithAI(text, u, query);
      setBusy(false);
      if (ai?.understanding) {
        const a = ai.understanding;
        const changes = diffLabels(u.criteria, a.criteria);
        next = { ...u, criteria: a.criteria, notes: a.notes, newcomer: u.newcomer || a.newcomer, changes, source: u.source === 'example' ? 'example' : 'ai' };
      }
    }
    if (!next) next = refine(u, text);
    if (!next.changes.length && next.notes.length === u.notes.length) {
      setToast({ text: 'I couldn\'t tell what to change. Try "under 120k", "near the metro" or "forget the park".' });
      return;
    }
    setU(next);
    setFlash(next.criteria.filter((c) => JSON.stringify(u.criteria.find((x) => x.field === c.field)) !== JSON.stringify(c)).map((c) => c.field));
    setToast({ text: next.changes.slice(0, 2).join(' · ') || 'Noted', undo: () => restore(before) });
  }

  function updateCriterion(i, c, msg) {
    const before = snapshot();
    const criteria = [...u.criteria]; criteria[i] = c;
    setU({ ...u, criteria }); setSheet(null); setFlash([c.field]);
    setToast({ text: msg || `Updated "${c.label}"`, undo: () => restore(before) });
  }
  function addCriterion(field) {
    const c = field === 'budget'
      ? { field, value: 150000, weight: 'must', certainty: 'confirmed', label: 'Up to 150k a year', quote: '' }
      : { field: 'beds', value: 2, weight: 'must', certainty: 'confirmed', label: '2 bedrooms', quote: '' };
    const criteria = [...u.criteria, c];
    setU({ ...u, criteria });
    setSheet({ type: 'edit', i: criteria.length - 1, k: Date.now(), isNew: true });
  }
  function removeCriterion(i) {
    const before = snapshot();
    const c = u.criteria[i];
    setU({ ...u, criteria: u.criteria.filter((_, j) => j !== i) }); setSheet(null);
    setToast({ text: `Removed "${c.label}"`, undo: () => restore(before) });
  }
  function relax(i) {
    const c = u.criteria[i];
    updateCriterion(i, { ...c, weight: 'nice' }, `"${c.label}" is now nice to have`);
  }

  function answer(q, o) {
    setAnswers((a) => ({ ...a, [q.id]: o.label }));
    setU((cur) => applyAnswer(cur, q.id, o.value, o.label));
  }

  function notForMe(s, kind) {
    const before = snapshot();
    const l = s.listing;
    let criteria = [...u.criteria], msg = 'Hidden';
    const idx = (f) => criteria.findIndex((c) => c.field === f);
    if (kind === 'price') {
      const v = Math.floor((l.rent - 1000) / 5000) * 5000;
      const i = idx('budget');
      const c = { field: 'budget', value: v, weight: 'must', certainty: 'confirmed', label: `Up to ${fmtK(v)} a year`, quote: 'you said a home was too expensive' };
      if (i >= 0) criteria[i] = { ...criteria[i], ...c }; else criteria.push(c);
      msg = `Budget set to under ${fmtK(v)}`;
    } else if (kind === 'far') {
      const i = idx('commute'); const c = criteria[i];
      const v = { ...c.value, max: Math.max(10, c.value.max - 5) };
      criteria[i] = { ...c, value: v, weight: 'must', certainty: 'confirmed', label: `≤ ${v.max} min to ${v.to} by ${v.mode === 'metro' ? 'metro' : 'car'}` };
      msg = `Trip shortened to ${v.max} min`;
    } else if (kind === 'area') {
      const i = idx('avoid');
      const name = AREAS[l.area].name.replace(/ \(.*\)/, '');
      if (i >= 0) { const vals = [...criteria[i].value, l.area]; criteria[i] = { ...criteria[i], value: vals, label: 'Not ' + vals.map((k) => AREAS[k].name.replace(/ \(.*\)/, '')).join(', ') }; }
      else criteria.push({ field: 'avoid', value: [l.area], weight: 'must', certainty: 'said', label: `Not ${name}`, quote: 'you hid a home here' });
      msg = `Hiding homes in ${name}`;
    }
    setU({ ...u, criteria }); setHidden((h) => [...h, l.id]); setSheet(null); setDetailId(null);
    setToast({ text: msg + (kind === 'just' ? '' : '. Your search is updated.'), undo: () => restore(before) });
  }

  function toggleSave(id) { setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); }

  const detailScored = detailId && u ? scoreListing(u.criteria, LISTINGS.find((l) => l.id === detailId)) : detailId ? scoreListing([], LISTINGS.find((l) => l.id === detailId)) : null;

  return (
    <div className="shell">
      <Device>
      <div className="app">
        <header className="top">
          {view === 'results'
            ? <button className="icon-btn" onClick={() => { setView('describe'); setDraft(query); }} aria-label="Back"><Icon.back /></button>
            : view === 'describe' && <span className="logo"><span className="logo-mark" aria-hidden />bayt</span>}
          <span className={`top-title ${view === 'saved' ? 'lg' : ''}`}>{view === 'results' ? 'Your search' : view === 'saved' ? 'Saved homes' : ''}</span>
          {view !== 'results' && (
            <button className="notes-btn" onClick={() => setSheet({ type: 'notes' })}>Design notes</button>
          )}
          {view === 'results' && (
            <button className={`saved-btn ${saved.length ? 'has' : ''}`} onClick={() => setView('saved')} aria-label={`Saved homes, ${saved.length}`}>
              <Icon.heart filled={saved.length > 0} width="18" height="18" />{saved.length > 0 && <span>{saved.length}</span>}
            </button>
          )}
        </header>

        {view === 'results' && u && !loading && scrolled && u.criteria.length > 0 && (
          <button className="summary" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="summary-t">{u.criteria.filter((c) => c.weight === 'must').map((c) => c.label).join(', ') || u.criteria.map((c) => c.label).join(', ')}</span>
            <span className="summary-a">Edit</span>
          </button>
        )}

        {/* Only this part scrolls: the nav bar above and the tab bar / composer below stay put */}
        <div className="scroll" ref={scrollRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 380)}>
        {view === 'describe' && (
          <main className="describe">
            <span className="badge">AI search for renters</span>
            <h1>Describe your next home</h1>
            <p className="lede">Write it the way you'd tell a friend. I'll show you what I understood before searching, so you can fix anything I got wrong.</p>
            <form className="prompt" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus
                placeholder="Two bedrooms near a park, quiet, no more than 25 minutes to DIFC…" aria-label="Describe your next home"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(draft); }} />
              <div className="prompt-bar">
                <span>Budget, area feel, commute, pets — anything</span>
                <VoiceButton />
                <button className="btn primary" disabled={!draft.trim()}>Find homes</button>
              </div>
            </form>
            <h2 className="ex-h">Try an example</h2>
            <div className="examples">
              {EXAMPLES.map((ex) => {
                const I = Icon[ex.icon];
                return (
                  <button key={ex.title} onClick={() => { setDraft(ex.text); submit(ex.text, { example: true }); }}>
                    <span className="ex-ic"><I /></span>
                    <span className="ex-tx"><strong>{ex.title}</strong><span>{ex.text}</span></span>
                  </button>
                );
              })}
            </div>
            <p className="foot">A prototype with 28 fictional rentals. No real listings, agents or prices.</p>
          </main>
        )}

        {view === 'results' && (
          <main className="results">
            {loading || !u ? <Loading query={query} /> : (
              <>
                <UnderstandingCard u={u} query={query} flashKeys={flash}
                  onEditText={() => { setDraft(query); setView('describe'); }}
                  onChip={(i) => setSheet({ type: 'edit', i, k: Date.now() })}
                  onLegend={() => setSheet({ type: 'legend' })}
                  mode={uMode} setMode={setUMode} onAdd={addCriterion} open={uOpen} setOpen={setUOpen} />

                {isEmpty ? (
                  <section className="empty">
                    <h2>I couldn't find anything to search with</h2>
                    <p>{u.notes[0].text}</p>
                    <button className="btn secondary" onClick={() => { setDraft(''); setView('describe'); }}>Start again</button>
                  </section>
                ) : askFirst ? (
                  <Questions qs={qs} answers={answers} onAnswer={answer} onSkip={() => setSkipped(true)} />
                ) : (
                  <>
                    {u.criteria.length > 0 && (
                      <div className="hints" aria-label="Ways to change your search">
                        <span>Change it in words:</span>
                        {REFINE_HINTS.map((h) => <button key={h} disabled={busy} onClick={() => onRefine(h)}>{h}</button>)}
                      </div>
                    )}
                    {zero ? (
                      <ZeroState u={u} hidden={hidden} onRelax={relax} res={res}
                        onOpen={(id) => setDetailId(id)} />
                    ) : (
                      <ResultList res={res} u={u} saved={saved} showAll={showAll} setShowAll={setShowAll} sort={sort} setSort={setSort}
                        onSave={toggleSave} onOpen={(id) => setDetailId(id)} onNotForMe={(s) => setSheet({ type: 'nfm', s })} />
                    )}
                    {hidden.length > 0 && (
                      <p className="foot">{hidden.length} home{hidden.length > 1 ? 's' : ''} hidden · <button className="link" onClick={() => setHidden([])}>Show again</button></p>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        )}

        {view === 'saved' && (
          <main className={`saved ${saved.length === 0 ? 'is-empty' : ''}`}>
            {saved.length === 0 ? (
              <section className="saved-empty">
                <span className="saved-empty-ic"><Icon.heart width="26" height="26" /></span>
                <h2>Nothing saved yet</h2>
                <p>Tap the heart on a home to keep it here while you decide.</p>
                <button className="btn secondary" onClick={() => setView(u ? 'results' : 'describe')}>{u ? 'Back to your search' : 'Start a search'}</button>
              </section>
            ) : saved.map((id) => {
              const s = scoreListing(u?.criteria || [], LISTINGS.find((l) => l.id === id));
              return (
                <button key={id} className="mini" onClick={() => setDetailId(id)}>
                  <div className="mini-art"><Photo listing={s.listing} height={72} /></div>
                  <div>
                    <strong>{fmtAED(s.listing.rent)}</strong>
                    <span>{s.listing.beds}-bed · {s.listing.building}</span>
                    <span className="muted small">{s.area.name}</span>
                  </div>
                </button>
              );
            })}
          </main>
        )}
        </div>

        {view !== 'results' && (
          <nav className="tabbar" aria-label="Main">
            <button className={view === 'describe' ? 'on' : ''} onClick={() => setView(view === 'saved' && u ? 'results' : 'describe')}><Icon.search /><span>Search</span></button>
            <button className={view === 'saved' ? 'on' : ''} onClick={() => setView('saved')}>
              <span className="tab-ic"><Icon.heart filled={view === 'saved'} width="22" height="22" />{saved.length > 0 && <em>{saved.length}</em>}</span><span>Saved</span>
            </button>
          </nav>
        )}

        {view === 'results' && u && !loading && !isEmpty && (
          <Composer onSend={onRefine} disabled={askFirst} busy={busy} />
        )}
      </div>

        {detailScored && (
          <div className="overlay">
            <Detail s={detailScored} criteria={u?.criteria || []} newcomer={u?.newcomer}
              saved={saved.includes(detailId)} onSave={() => toggleSave(detailId)}
              onBack={() => setDetailId(null)} onMessage={() => setSheet({ type: 'msg', s: detailScored })} />
          </div>
        )}

        {sheet?.type === 'legend' && <LegendSheet open onClose={() => setSheet(null)} />}
        {sheet?.type === 'edit' && u.criteria[sheet.i] && (
          <EditSheet key={sheet.k} c={u.criteria[sheet.i]} isNew={sheet.isNew}
            onClose={() => { if (sheet.isNew) setU({ ...u, criteria: u.criteria.filter((_, j) => j !== sheet.i) }); setSheet(null); }}
            onSave={(c) => updateCriterion(sheet.i, c, sheet.isNew ? `Added "${c.label}"` : undefined)} onRemove={() => removeCriterion(sheet.i)} />
        )}
        {sheet?.type === 'nfm' && <NotForMeSheet s={sheet.s} criteria={u.criteria} onPick={(k) => notForMe(sheet.s, k)} onClose={() => setSheet(null)} />}
        {sheet?.type === 'msg' && <MessageSheet s={sheet.s} criteria={u?.criteria || []} newcomer={u?.newcomer} onClose={() => setSheet(null)} />}

        {sheet?.type === 'notes' && (
          <div className="notes-sheet" role="dialog" aria-modal="true" aria-label="Design notes">
            <div className="notes-sheet-top">
              <strong>Design notes</strong>
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label="Close"><Icon.close /></button>
            </div>
            <NotesPanel onTry={tryScenario} compact />
          </div>
        )}

        {toast && (
          <div className="toast" role="status">
            <span>{toast.text}</span>
            {toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}
          </div>
        )}
      </Device>
      <aside className="notes-side" aria-label="Design notes">
        <NotesPanel onTry={tryScenario} />
      </aside>
    </div>
  );
}

// What changed, by field, in the same words the scripted path uses
function diffLabels(a, b) {
  const out = [];
  for (const c of b) {
    const old = a.find((x) => x.field === c.field);
    if (!old) out.push(`Added "${c.label}"`);
    else if (old.label !== c.label) out.push(`Updated "${c.label}"`);
    else if (old.weight !== c.weight) out.push(`"${c.label}" is now ${c.weight === 'must' ? 'a must' : 'nice to have'}`);
  }
  for (const c of a) if (!b.some((x) => x.field === c.field)) out.push(`Removed "${c.label}"`);
  return out;
}

function Loading({ query }) {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setTimeout(() => setStep(1), 550); return () => clearTimeout(t); }, []);
  return (
    <section className="loading" aria-live="polite">
      <div className="u-quote"><p>“{query}”</p></div>
      <ul>
        <li className={step >= 0 ? 'on' : ''}>Reading what you wrote</li>
        <li className={step >= 1 ? 'on' : ''}>Checking {LISTINGS.length} homes against it</li>
      </ul>
      <div className="skel" /><div className="skel short" /><div className="skel tall" />
    </section>
  );
}

function ResultList({ res, u, saved, showAll, setShowAll, sort, setSort, onSave, onOpen, onNotForMe }) {
  const ordered = sort === 'price' ? [...res.fits].sort((a, b) => a.listing.rent - b.listing.rent) : res.fits;
  const fits = showAll ? ordered : ordered.slice(0, 5);
  const close = res.close.slice(0, 3);
  const noCriteria = u.criteria.length === 0;
  return (
    <>
      {res.fits.length > 0 && (
        <section className="r-sec">
          <div className="r-head">
            <div>
              <h2>{noCriteria ? `All ${res.fits.length} homes` : `${res.fits.length} home${res.fits.length > 1 ? 's' : ''} fit${res.fits.length > 1 ? '' : 's'} your must-haves`}</h2>
              <p className="u-sub">{noCriteria ? 'Tell me more and I\'ll narrow this down.' : `Out of ${res.checked} fictional homes`}</p>
            </div>
            {res.fits.length > 1 && (
              <button className="sort" onClick={() => setSort(sort === 'best' ? 'price' : 'best')} aria-label={`Sorted by ${sort === 'best' ? 'best match' : 'lowest price'}. Tap to change.`}>
                <Icon.sort />{sort === 'best' ? 'Best match' : 'Lowest price'}
              </button>
            )}
          </div>
          {fits.map((s) => (
            <ListingCard key={s.listing.id} s={s} saved={saved.includes(s.listing.id)} showIntro={u.newcomer}
              onSave={() => onSave(s.listing.id)} onOpen={() => onOpen(s.listing.id)} onNotForMe={() => onNotForMe(s)} />
          ))}
          {!showAll && res.fits.length > 5 && <button className="btn ghost wide" onClick={() => setShowAll(true)}>Show {res.fits.length - 5} more</button>}
        </section>
      )}
      {close.length > 0 && (
        <section className="r-sec">
          <h2>Close, with one trade-off</h2>
          <p className="u-sub">Each misses one must-have by a little. The trade-off is listed first.</p>
          {close.map((s) => (
            <ListingCard key={s.listing.id} s={s} saved={saved.includes(s.listing.id)} showIntro={u.newcomer}
              onSave={() => onSave(s.listing.id)} onOpen={() => onOpen(s.listing.id)} onNotForMe={() => onNotForMe(s)} />
          ))}
        </section>
      )}
    </>
  );
}

function ZeroState({ u, hidden, res, onRelax, onOpen }) {
  const rel = relaxations(u.criteria, hidden).filter((r) => r.count > 0).slice(0, 3);
  const floor = budgetFloor(u.criteria, hidden);
  const budget = u.criteria.find((c) => c.field === 'budget');
  const closest = [...res.scored].sort((a, b) => a.mustMiss - b.mustMiss || b.score - a.score).slice(0, 3);
  return (
    <section className="zero">
      <h2>Nothing fits all your must-haves</h2>
      {floor && budget && floor > budget.value ? (
        <p>Homes that match everything else start at <strong>{fmtAED(floor)}</strong> a year — {fmtK(floor - budget.value)} above your budget.</p>
      ) : (
        <p>Together, your must-haves rule out all {res.checked} homes I checked.</p>
      )}
      {rel.length > 0 ? (
        <>
          <h4>Make one of these flexible</h4>
          <div className="relax">
            {rel.map((r) => (
              <button key={r.index} onClick={() => onRelax(r.index)}>
                <span>{r.c.label}<small>Make it nice to have</small></span><strong>Shows {r.count} home{r.count > 1 ? 's' : ''}</strong>
              </button>
            ))}
          </div>
        </>
      ) : <p className="muted">Relaxing any single one isn't enough. Tap two of them above to make them nice to have.</p>}
      <h4>Closest I have</h4>
      {closest.map((s) => (
        <button key={s.listing.id} className="mini" onClick={() => onOpen(s.listing.id)}>
          <div className="mini-art"><Photo listing={s.listing} height={72} /></div>
          <div>
            <strong>{fmtAED(s.listing.rent)}</strong>
            <span>{s.listing.beds}-bed · {s.area.name.replace(/ \(.*\)/, '')}</span>
            <span className="miss-line">{s.evals.filter((e) => e.c.weight === 'must' && e.r.status !== 'match').map((e) => e.r.text).join(' · ')}</span>
          </div>
        </button>
      ))}
    </section>
  );
}

// Voice input is shown to signal intent; it isn't wired up in the prototype
function VoiceButton({ small }) {
  return (
    <button type="button" className={`voice ${small ? 'small' : ''}`} aria-disabled="true" tabIndex={-1}
      title="Voice input — not in this prototype" aria-label="Voice input, not available in this prototype"
      onClick={(e) => e.preventDefault()}>
      <Icon.mic />
    </button>
  );
}

function Composer({ onSend, disabled, busy }) {
  const [v, setV] = useState('');
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSend(v); setV(''); } }}>
      <div className="composer-field">
      <input value={v} onChange={(e) => setV(e.target.value)} disabled={disabled || busy}
        placeholder={disabled ? 'Answer or skip the questions first' : busy ? 'Updating your search…' : 'Change something…'} aria-label="Change your search" />
      <VoiceButton small />
      </div>
      <button className={`send ${busy ? 'busy' : ''}`} disabled={!v.trim() || disabled || busy} aria-label="Update search">{busy ? <span className="spin" /> : <Icon.send />}</button>
    </form>
  );
}
