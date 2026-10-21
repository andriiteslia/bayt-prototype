import { useEffect } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
export const Icon = {
  check: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  partial: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M5 12h14" /></svg>,
  unknown: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><circle cx="12" cy="17.5" r=".6" fill="currentColor" /></svg>,
  miss: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M7 7l10 10M17 7L7 17" /></svg>,
  heart: ({ filled, ...p }) => <svg viewBox="0 0 24 24" width="20" height="20" {...P} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  back: (p) => <svg viewBox="0 0 24 24" width="22" height="22" {...P} {...p}><path d="M15 5l-7 7 7 7" /></svg>,
  send: (p) => <svg viewBox="0 0 24 24" width="20" height="20" {...P} {...p}><path d="M5 12h13M13 6l6 6-6 6" /></svg>,
  close: (p) => <svg viewBox="0 0 24 24" width="20" height="20" {...P} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  info: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".6" fill="currentColor" /></svg>,
  pencil: (p) => <svg viewBox="0 0 24 24" width="15" height="15" {...P} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" width="14" height="14" {...P} {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  chevron: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M6 9l6 6 6-6" /></svg>,
  mic: (p) => <svg viewBox="0 0 24 24" width="20" height="20" {...P} {...p}><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" width="22" height="22" {...P} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>,
  plane: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><path d="M3 13l18-7-6 15-3-6z" /><path d="M12 15l3-3" /></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  wallet: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M16 12.5h1.5M3.5 9.5h17" /></svg>,
  eye: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.5" /></svg>,
  sort: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" /></svg>,
  stop: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} {...p}><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></svg>,
};

export function StatusIcon({ status }) {
  const I = { match: Icon.check, partial: Icon.partial, unknown: Icon.unknown, miss: Icon.miss }[status] || Icon.unknown;
  return <span className={`st st-${status}`} aria-label={STATUS_LABEL[status]}><I width="14" height="14" /></span>;
}
export const STATUS_LABEL = { match: 'Fits', partial: 'Partly fits', unknown: 'Not stated', miss: 'Doesn\'t fit' };

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
