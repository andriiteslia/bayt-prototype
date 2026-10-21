// Client side of the live reading. Returns null on any failure so the caller can fall back.
const CLIENT_TIMEOUT = 10000;

export async function readWithAI(text, current = null, previousText = '') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT);
  try {
    const r = await fetch('api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, current, previousText }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.ok) return { failed: data.error || 'unknown' };
    return { understanding: data.understanding, ms: data.ms };
  } catch {
    return { failed: 'network' };
  } finally {
    clearTimeout(t);
  }
}
