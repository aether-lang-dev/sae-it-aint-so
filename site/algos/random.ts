// A seeded generator (mulberry32), so a shuffle is the same on every run:
// two algorithms race on the same bars, and a test knows what they will be.
export class Rng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  // A float in [0, 1).
  next(): number {
    let t = (this.#state = (this.#state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // An integer in [0, n).
  below(n: number): number {
    return Math.floor(this.next() * n);
  }
}

// 1..n in an order `seed` decides (Fisher-Yates).
export function shuffled(n: number, seed: number): number[] {
  const rng = new Rng(seed);
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = rng.below(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
