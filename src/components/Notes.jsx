import { useState } from 'react';
import { NOTES } from '../data/notes.js';

const TABS = [
  ['framing', 'Framing'],
  ['decisions', 'Decisions'],
  ['try', 'Try these'],
  ['production', 'Production'],
  ['test', 'Test plan'],
];

export function NotesPanel({ onTry, compact }) {
  const [tab, setTab] = useState('framing');
  const N = NOTES;
  return (
    <div className={`notes ${compact ? 'compact' : ''}`}>
      {!compact && (
        <header className="notes-head">
          <p className="notes-kicker">Design notes</p>
          <h1>{N.intro.title}</h1>
          <p>{N.intro.text}</p>
          <p className="notes-bet">{N.intro.bet}</p>
        </header>
      )}
      <nav className="notes-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <div className="notes-body">
        {tab === 'framing' && (
          <>
            {compact && <p className="notes-bet">{N.intro.bet}</p>}
            <section>
              <h2>Persona</h2>
              <p className="persona"><strong>{N.framing.persona.name}.</strong> {N.framing.persona.line}</p>
              <dl className="notes-dl">
                {N.framing.assumptions.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
              </dl>
              <p className="notes-why">{N.framing.why}</p>
            </section>
            <section>
              <h2>The job</h2>
              <p>{N.framing.job}</p>
              <p className="muted">Out of scope: {N.framing.out.join(', ')}.</p>
            </section>
            <section>
              <h2>What I changed in the brief</h2>
              <p>{N.framing.changed}</p>
            </section>
          </>
        )}

        {tab === 'decisions' && (
          <ol className="decisions">
            {N.decisions.map((d) => (
              <li key={d.title}>
                <h3>{d.title}</h3>
                <p>{d.why}</p>
                <p className="cost"><span>Trade-off</span>{d.cost}</p>
              </li>
            ))}
          </ol>
        )}

        {tab === 'try' && (
          <div className="scen">
            <p className="muted">Each one shows a different edge case. Run it in the phone and check the behaviour described.</p>
            {N.scenarios.map((sc) => (
              <div key={sc.title} className="scen-item">
                <div>
                  <h3>{sc.title}</h3>
                  {sc.text && <p className="scen-q">“{sc.text}”</p>}
                  <p>{sc.look}</p>
                </div>
                {sc.text && <button className="btn secondary" onClick={() => onTry(sc.text)}>Run</button>}
              </div>
            ))}
          </div>
        )}

        {tab === 'production' && (
          <dl className="notes-dl wide">
            {N.production.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
          </dl>
        )}

        {tab === 'test' && (
          <>
            <section>
              <h2>Qualitative first</h2>
              <p>{N.test.first}</p>
              <h3>Tasks</h3>
              <ul>{N.test.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
              <h3>What I'll watch for</h3>
              <ul>{N.test.watch.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
            <section>
              <h2>Then measure</h2>
              <p>{N.test.then}</p>
              <dl className="notes-dl">
                {N.test.metrics.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
              </dl>
            </section>
            <section>
              <h2>Next, not done</h2>
              <p>{N.next.join(' · ')}</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
