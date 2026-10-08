// sae:noise: deterministic under a seed, smooth, in range, and the free
// functions agree with the seeded object.
import { noise, value1, value2, perlin1, perlin2, fbm2, hash2, random } from "sae:noise";
const f = (v: number) => v.toFixed(4);
const n = noise(7);
print("seeded equals free:", n.perlin2(1.3, 2.7) === perlin2(1.3, 2.7, 7), n.value1(0.4) === value1(0.4, 7));
print("other seed differs:", perlin2(1.3, 2.7, 8) !== perlin2(1.3, 2.7, 7));
print("perlin is 0 on the lattice:", f(perlin1(3, 7)), f(perlin2(2, 5, 7)));
print("value1:", [0, 0.25, 0.5, 0.75, 1].map((t) => f(n.value1(t))).join(" "));
let inRange = true, maxAbs = 0;
for (let i = 0; i < 2000; i++) {
  const x = i * 0.137, y = i * 0.071;
  const v = n.value2(x, y), p = n.perlin2(x, y), b = n.fbm2(x, y, { octaves: 5 });
  if (v < 0 || v > 1 || p < -1 || p > 1 || b < -1 || b > 1) inRange = false;
  maxAbs = Math.max(maxAbs, Math.abs(p));
}
print("in range:", inRange, "perlin reaches past 0.5:", maxAbs > 0.5);
let smooth = true;
for (let i = 0; i < 500; i++) {
  if (Math.abs(n.perlin1(i * 0.01) - n.perlin1(i * 0.01 + 0.001)) > 0.02) smooth = false;
}
print("smooth:", smooth);
const r = random(3), r2 = random(3);
print("random stream repeats:", r() === r2(), r() === r2(), f(r()) === f(r2()));
print("hash2 in [0,1):", hash2(5, 9, 1) >= 0 && hash2(5, 9, 1) < 1, hash2(5, 9, 1) !== hash2(9, 5, 1));
print("fbm octaves:", f(n.fbm2(0.3, 0.6, { octaves: 1 })) === f(n.perlin2(0.3, 0.6)));
// expect: seeded equals free: true true
// expect: other seed differs: true
// expect: perlin is 0 on the lattice: 0.0000 0.0000
// expect: value1: 0.1725 0.1658 0.1398 0.1139 0.1071
// expect: in range: true perlin reaches past 0.5: true
// expect: smooth: true
// expect: random stream repeats: true true true
// expect: hash2 in [0,1): true true
// expect: fbm octaves: true
