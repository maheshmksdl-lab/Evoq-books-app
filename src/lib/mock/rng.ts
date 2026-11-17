export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof makeRng>;
export function makeRng(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a: number, b: number) => a + r() * (b - a),
    int: (a: number, b: number) => Math.floor(a + r() * (b - a + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    chance: (p: number) => r() < p,
    weighted: <T,>(arr: readonly T[], w: readonly number[]): T => {
      const total = w.reduce((s, x) => s + x, 0);
      let x = r() * total;
      for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x <= 0) return arr[i]; }
      return arr[arr.length - 1];
    },
  };
}
