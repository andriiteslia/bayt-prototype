import { useState } from 'react';
import HomeArt from './HomeArt.jsx';
import { Icon, StatusIcon, Sheet } from './ui.jsx';
import { fmtAED } from '../lib/interpret.js';

const ORDER = { miss: 0, partial: 1, unknown: 2, match: 3 };
const typeName = (l) => (l.beds === 0 ? 'Studio' : `${l.beds}-bed ${l.type}`);

export function FitList({ evals, limit, showSource }) {
  // Problems first, so the bad news is never below the fold
  const sorted = [...evals].sort((a, b) => ORDER[a.r.status] - ORDER[b.r.status] || (a.c.weight === 'must' ? -1 : 1));
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <ul className="fit">
      {shown.map((e, i) => (
        <li key={i} className={`fit-${e.r.status}`}>
          <StatusIcon status={e.r.status} />
          <span className="fit-t">{e.r.text}</span>
          {showSource && <span className={`src src-${e.r.source}`}>{e.r.source === 'agent' ? 'Agent' : 'Estimate'}</span>}
        </li>
      ))}
      {limit && sorted.length > limit && <li className="fit-more">+{sorted.length - limit} more in details</li>}
    </ul>
  );
}

export function ListingCard({ s, saved, onSave, onOpen, onNotForMe, showIntro }) {
  const l = s.listing;
  const issues = s.evals.filter((e) => e.r.status !== 'match').length;
  return (
    <article className="card">
      <div className="card-art" onClick={onOpen}>
        <HomeArt listing={l} height={210} />
        <span className="art-tag">Illustration</span>
        {l.verified && <span className="verified"><Icon.shield /> Checked listing</span>}
      </div>
      <button className={`save ${saved ? 'on' : ''}`} onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'}>
        <Icon.heart filled={saved} />
      </button>
      <div className="card-body">
        <div className="price"><strong>{fmtAED(l.rent)}</strong><span>/year</span></div>
        <h3 className="card-title" onClick={onOpen}>{typeName(l)} · {l.building}</h3>
        <p className="card-area">{s.area.name}</p>
        {showIntro && <p className="card-intro">{s.area.intro}</p>}
        {s.evals.length > 0 && (
          <div className="card-fit">
            <p className="fit-sum">{issues === 0 ? 'Fits everything you asked' : `Fits ${s.evals.length - issues} of ${s.evals.length}`}</p>
            <FitList evals={s.evals} limit={4} />
          </div>
        )}
        <div className="card-actions">
          <button className="btn ghost" onClick={onNotForMe}>Not for me</button>
          <button className="btn secondary" onClick={onOpen}>See details</button>
        </div>
      </div>
    </article>
  );
}

export function agentQuestions(s, criteria) {
  const l = s.listing, qs = [];
  const has = (f) => criteria.some((c) => c.field === f);
  if (l.pets == null && has('pets')) qs.push('Are pets allowed, and is there a pet deposit?');
  if (l.furnished == null) qs.push('Is it furnished, part-furnished or unfurnished?');
  if (has('quiet')) qs.push('Which side does the flat face, and is there any construction nearby?');
  const avail = s.evals.find((e) => e.c.field === 'available');
  if (avail && avail.r.status === 'partial') qs.push(`Could the landlord hold it until ${avail.c.value}?`);
  qs.push('How many cheques will the landlord accept for the yearly rent?');
  qs.push('Is it still available, and can I do a video viewing first?');
  return qs;
}

export function Detail({ s, criteria, saved, onSave, onBack, onMessage, newcomer }) {
  const l = s.listing;
  const facts = [
    ['Bedrooms', l.beds === 0 ? 'Studio' : l.beds, 'agent'],
    ['Bathrooms', l.baths, 'agent'],
    ['Size', `${l.sqft.toLocaleString()} sq ft`, 'agent'],
    ['Furnishing', l.furnished == null ? 'Not stated' : l.furnished ? 'Furnished' : 'Unfurnished', 'agent'],
    ['Pets', l.pets == null ? 'Not stated' : l.pets === 'allowed' ? 'Allowed' : 'Not allowed', 'agent'],
    ['Available', l.available === 'Now' ? 'Now' : `From ${l.available}`, 'agent'],
    ['Park', l.parkWalk == null ? 'Not known' : `${l.parkWalk} min walk`, 'estimate'],
    ['Metro', l.metroWalk == null ? 'Not walkable' : `${l.metroWalk} min walk`, 'estimate'],
  ];
  return (
    <div className="detail">
      <div className="detail-top">
        <HomeArt listing={l} height={240} rounded={false} />
        <button className="icon-btn float left" onClick={onBack} aria-label="Back to results"><Icon.back /></button>
        <button className={`icon-btn float right save-d ${saved ? 'on' : ''}`} onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save'}><Icon.heart filled={saved} /></button>
        <span className="art-tag">Illustration</span>
      </div>
      <div className="detail-body">
        <div className="price lg"><strong>{fmtAED(l.rent)}</strong><span>/year · about {fmtAED(l.rent / 12)} a month</span></div>
        <h1>{typeName(l)} in {l.building}</h1>
        <p className="card-area">{s.area.name}</p>
        <p className="meta">Listed {l.listedDays} day{l.listedDays > 1 ? 's' : ''} ago by {l.agency} (fictional){l.verified ? ' · details checked by Bayt' : ''}</p>

        {s.evals.length > 0 && (
          <section className="d-sec">
            <h2>How it fits what you asked</h2>
            <FitList evals={s.evals} showSource />
          </section>
        )}

        <section className="d-sec">
          <h2>Ask the agent before viewing</h2>
          <p className="muted small">Things the listing doesn't answer, or that matter when renting from abroad.</p>
          <ul className="ask">{agentQuestions(s, criteria).map((q) => <li key={q}>{q}</li>)}</ul>
        </section>

        <section className="d-sec">
          <h2>The home</h2>
          <dl className="facts">
            {facts.map(([k, v, src]) => (
              <div key={k} className={v === 'Not stated' ? 'unknown' : ''}><dt>{k}</dt><dd>{v} <span className={`src src-${src}`}>{src === 'agent' ? 'Agent' : 'Estimate'}</span></dd></div>
            ))}
          </dl>
          {l.features.length > 0 && <p className="features">{l.features.map((f) => <span key={f}>{f}</span>)}</p>}
        </section>

        <section className="d-sec area-box">
          <h2>About {s.area.name}</h2>
          <p>{s.area.intro}</p>
          {newcomer && <p className="muted small">A short description by Bayt, not a full guide. Worth a video call with the agent to see the street.</p>}
        </section>
      </div>
      <div className="detail-cta">
        <button className="btn secondary" onClick={onSave}>{saved ? 'Saved' : 'Save'}</button>
        <button className="btn primary" onClick={onMessage}>Message agent</button>
      </div>
    </div>
  );
}

export function MessageSheet({ s, criteria, newcomer, onClose }) {
  const l = s.listing;
  const move = criteria.find((c) => c.field === 'available');
  const qs = agentQuestions(s, criteria).slice(0, 4);
  const [text, setText] = useState(
    `Hi, I'm interested in the ${typeName(l)} in ${l.building} (${fmtAED(l.rent)}/year).` +
    (newcomer ? ` I'm relocating to Dubai${move ? ` in ${move.label.replace('Move in ', '')}` : ''}.` : '') +
    `\n\nBefore a viewing, could you confirm:\n` + qs.map((q) => `– ${q}`).join('\n') + `\n\nThank you!`);
  const [copied, setCopied] = useState(false);
  return (
    <Sheet open onClose={onClose} title={`Message ${l.agency}`}
      footer={<button className="btn primary wide" onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); }}>{copied ? 'Copied' : 'Copy message'}</button>}>
      <p className="muted small">I drafted this from what you told me and what the listing doesn't say. Edit anything.</p>
      <textarea className="msg" value={text} onChange={(e) => setText(e.target.value)} rows={10} aria-label="Message" />
      <p className="muted small">Demo: nothing is sent. In the app this would open WhatsApp or the agent chat.</p>
    </Sheet>
  );
}

export function NotForMeSheet({ s, criteria, onPick, onClose }) {
  const l = s.listing;
  const commute = criteria.find((c) => c.field === 'commute');
  const opts = [
    { id: 'price', label: 'Too expensive', sub: `Lower your budget below ${fmtAED(l.rent)}` },
    commute && { id: 'far', label: 'Too far', sub: `Shorten the trip to ${commute.value.to} by 5 minutes` },
    { id: 'area', label: `Not ${s.area.name.replace(/ \(.*\)/, '')}`, sub: 'Hide all homes in this area' },
    { id: 'just', label: 'Just not this one', sub: 'Hide only this home' },
  ].filter(Boolean);
  return (
    <Sheet open onClose={onClose} title="What's not right?">
      <p className="muted small">I'll use your answer to adjust the search, and show you what changed.</p>
      <div className="nfm">
        {opts.map((o) => (
          <button key={o.id} onClick={() => onPick(o.id)}><strong>{o.label}</strong><span>{o.sub}</span></button>
        ))}
      </div>
    </Sheet>
  );
}
