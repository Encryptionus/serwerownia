/** Deterministyczny generator (mulberry32) - stan trzymany w GameState, więc partia jest odtwarzalna. */
export function nextRandom(state: number): { value: number; state: number } {
  let a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a };
}

export function nextInt(state: number, maxExclusive: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * maxExclusive), state: r.state };
}

export function shuffle<T>(items: T[], state: number): { items: T[]; state: number } {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.state;
    const j = r.value;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, state: s };
}
