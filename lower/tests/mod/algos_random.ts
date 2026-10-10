// site/algos/random.ts: a seed decides the sequence, and a shuffle is a
// permutation of 1..n.
import { Rng, shuffled } from "./algos/random.ts";
import { eq } from "./lib/check.ts";

const draw = (seed: number) => { const r = new Rng(seed); return Array.from({ length: 5 }, () => r.next()); };
eq("the same seed, the same sequence", draw(42), draw(42));
eq("another seed, another sequence", draw(42).join() === draw(43).join(), false);

const r = new Rng(9);
const xs = Array.from({ length: 2000 }, () => r.next());
eq("next is in [0, 1)", xs.every((x) => x >= 0 && x < 1), true);
const ns = Array.from({ length: 2000 }, () => r.below(6));
eq("below(6) covers 0..5 and nothing else", [...new Set(ns)].sort(), [0, 1, 2, 3, 4, 5]);

for (const n of [0, 1, 2, 24]) {
  const s = shuffled(n, 7);
  eq(`shuffled(${n}) is a permutation of 1..${n}`, [...s].sort((p, q) => p - q), Array.from({ length: n }, (_, i) => i + 1));
}
eq("shuffled is repeatable", shuffled(24, 7), shuffled(24, 7));
eq("shuffled(24, 7) moves things", shuffled(24, 7).some((v, i) => v !== i + 1), true);
eq("the demo's opening bars", shuffled(24, 7).join(" "), "21 7 19 24 17 12 16 13 14 23 6 10 3 4 20 18 5 9 8 11 15 22 2 1");
// expect: ok the same seed, the same sequence
// expect: ok another seed, another sequence
// expect: ok next is in [0, 1)
// expect: ok below(6) covers 0..5 and nothing else
// expect: ok shuffled(0) is a permutation of 1..0
// expect: ok shuffled(1) is a permutation of 1..1
// expect: ok shuffled(2) is a permutation of 1..2
// expect: ok shuffled(24) is a permutation of 1..24
// expect: ok shuffled is repeatable
// expect: ok shuffled(24, 7) moves things
// expect: ok the demo's opening bars
