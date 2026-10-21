// Illustrative building drawings instead of photos: honest for fictional listings,
// and clearly labelled as illustrations in the UI.
import { AREAS } from '../data/areas.js';

function rand(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export default function HomeArt({ listing, height = 168, rounded = true }) {
  const [sky, ground] = AREAS[listing.area].palette;
  const r = rand(listing.id);
  const W = 360, H = 200;
  const parts = [];

  if (listing.type === 'apartment') {
    // a main tower plus two background towers
    const bg = [0.15 + r() * 0.15, 0.68 + r() * 0.15].map((x, i) => {
      const w = 44 + r() * 20, h = 90 + r() * 50;
      return <rect key={'b' + i} x={x * W} y={H - 26 - h} width={w} height={h} fill={ground} opacity="0.35" rx="2" />;
    });
    parts.push(...bg);
    const tw = 92, th = 120 + r() * 40, tx = W / 2 - tw / 2, ty = H - 26 - th;
    parts.push(<rect key="t" x={tx} y={ty} width={tw} height={th} fill="#fbfaf7" stroke={ground} strokeWidth="1.5" rx="3" />);
    for (let y = ty + 12; y < H - 40; y += 16)
      for (let x = tx + 10; x < tx + tw - 10; x += 18)
        parts.push(<rect key={`w${x}-${y}`} x={x} y={y} width="10" height="8" fill={ground} opacity={0.25 + r() * 0.5} rx="1" />);
  } else {
    const villa = listing.type === 'villa';
    const n = villa ? 1 : 3, uw = villa ? 170 : 74, uh = villa ? 70 : 82;
    const startX = W / 2 - (n * uw) / 2;
    for (let i = 0; i < n; i++) {
      const x = startX + i * uw;
      parts.push(<rect key={'u' + i} x={x} y={H - 26 - uh} width={uw - 4} height={uh} fill="#fbfaf7" stroke={ground} strokeWidth="1.5" rx="3" />);
      parts.push(<rect key={'d' + i} x={x + uw / 2 - 12} y={H - 26 - 34} width="20" height="34" fill={ground} opacity="0.55" rx="2" />);
      parts.push(<rect key={'wa' + i} x={x + 10} y={H - 26 - uh + 14} width="22" height="16" fill={ground} opacity="0.35" rx="1" />);
      parts.push(<rect key={'wb' + i} x={x + uw - 36} y={H - 26 - uh + 14} width="22" height="16" fill={ground} opacity="0.35" rx="1" />);
    }
    // palm
    const px = villa ? W / 2 + 110 : W / 2 + 128;
    parts.push(<path key="trunk" d={`M${px} ${H - 26} q 6 -40 2 -78`} stroke={ground} strokeWidth="5" fill="none" strokeLinecap="round" />);
    [-60, -20, 20, 60, 100].forEach((a, i) => {
      const rad = (a * Math.PI) / 180, len = 34;
      parts.push(<path key={'f' + i} d={`M${px + 2} ${H - 104} q ${Math.cos(rad) * len * 0.6} ${-12} ${Math.cos(rad) * len} ${Math.sin(Math.abs(rad)) * 14}`} stroke={ground} strokeWidth="4" fill="none" strokeLinecap="round" />);
    });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" width="100%" height={height}
      style={{ display: 'block', borderRadius: rounded ? 14 : 0, background: sky }} role="img" aria-label={`Illustration of ${listing.building}`}>
      <circle cx={W * (0.15 + r() * 0.7)} cy={36} r="16" fill="#fff" opacity="0.55" />
      {parts}
      <rect x="0" y={H - 26} width={W} height="26" fill={ground} opacity="0.5" />
    </svg>
  );
}
