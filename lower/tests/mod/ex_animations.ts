// examples/animations, headless: the spinner's alpha, the tree's recursion and
// the particles' physics from Tsyne's spinner, fractal-tree and particles
// demos (Paul Hammant, MIT), at held times and a seeded generator.
import { segmentAlpha, tree, growthPhase, swayAngle, ParticleSystem, seeded } from "./examples/animations/lib/animations.ts";
import { eq } from "./lib/check.ts";

const q = (v: number) => Math.round(v * 1000) / 1000;
eq("the spinner at t=0.5 (half a turn): segment 0 is fully lit, 1 three quarters, 4 dim", [0, 1, 2, 4].map((i) => q(segmentAlpha(i, 0.5))), [1, 0.75, 0.5, 0.2]);
eq("a full turn later it is the same", q(segmentAlpha(0, 1.5)), 1);
eq("no segment is ever dimmer than 0.2 or brighter than 1", (() => { let lo = 1, hi = 0; for (let i = 0; i < 8; i++) for (let t = 0; t < 4; t += 0.05) { const a = segmentAlpha(i, t); lo = Math.min(lo, a); hi = Math.max(hi, a); } return [q(lo), q(hi)]; })(), [0.2, 1]);
const full = tree(1);
eq("the tree has 31 branches and 32 leaves", [full.branches.length, full.leaves.length], [31, 32]);
eq("its trunk is 60 long, straight up from (200, 400), 6 thick", [q(full.branches[0].x2), q(full.branches[0].y2), full.branches[0].thickness], [200, 340, 6]);
eq("each level is 0.7 as long and 0.8 as thick: the two branches off the trunk", [q(Math.hypot(full.branches[1].x2 - 200, full.branches[1].y2 - 340)), q(full.branches[1].thickness), full.branches[1].depth], [42, 4.8, 4]);
eq("the first branch off the trunk leans right (angle + 0.4 from straight up), the second left", [full.branches[1].x2 > 200, full.branches.find((b, i) => i > 1 && b.depth === 4)!.x2 < 200], [true, true]);
eq("at growth 0 every branch has no length, and the leaves sit on the root", [tree(0).branches.every((b) => b.x1 === b.x2 && b.y1 === b.y2), tree(0).leaves.every((l) => l.x === 200 && l.y === 400)], [true, true]);
eq("growth takes three seconds; the sway is 0.015 radian a second", [growthPhase(0), growthPhase(1.5), growthPhase(9), q(swayAngle(10))], [0, 0.5, 1, 0.15]);

const a = new ParticleSystem(7), b = new ParticleSystem(7), c = new ParticleSystem(8);
eq("twenty particles to start, at the emitter", [a.particles.length, a.particles.every((p) => p.x === 200 && p.y === 250 && p.lifetime === 1)], [20, true]);
eq("the same seed is the same particles, another seed is not", [JSON.stringify(a.particles) === JSON.stringify(b.particles), JSON.stringify(a.particles) === JSON.stringify(c.particles)], [true, false]);
eq("speeds are 100 to 250 and radii 3 to 6", [a.particles.every((p) => { const s = Math.hypot(p.vx, p.vy); return s >= 100 && s <= 250; }), a.particles.every((p) => p.radius >= 3 && p.radius <= 6)], [true, true]);
const dt = 0.016;
for (let i = 0; i < 31; i++) a.update(dt);
eq("half a second on (31 steps of 16 ms): a particle every 0.05 s joined them, nine of them", a.particles.length, 29);
const p0 = a.particles[0];
eq("lifetime falls by half a unit a second", q(p0.lifetime), q(1 - 0.5 * 31 * dt));
eq("gravity has pulled them down: the average vertical speed rose by about 200 x 0.5 s", q(a.particles.slice(0, 20).reduce((t, p) => t + p.vy, 0) / 20) > q(b.particles.reduce((t, p) => t + p.vy, 0) / 20), true);
const d = new ParticleSystem(3);
for (let i = 0; i < 200; i++) d.update(dt);
eq("after two seconds the first twenty are gone (lifetime 2 s), and the count settles", [d.particles.some((p) => p.id < 20), d.particles.length > 20 && d.particles.length < 50], [false, true]);
d.burst(10, 10);
eq("a burst adds thirty at the click", [d.particles.filter((p) => p.x === 10 && p.y === 10).length], [30]);
const r = seeded(5), r2 = seeded(5);
eq("the generator repeats and stays in [0, 1)", [r() === r2(), (() => { const g = seeded(9); for (let i = 0; i < 1000; i++) { const v = g(); if (v < 0 || v >= 1) return false; } return true; })()], [true, true]);
// expect: ok the spinner at t=0.5 (half a turn): segment 0 is fully lit, 1 three quarters, 4 dim
// expect: ok a full turn later it is the same
// expect: ok no segment is ever dimmer than 0.2 or brighter than 1
// expect: ok the tree has 31 branches and 32 leaves
// expect: ok its trunk is 60 long, straight up from (200, 400), 6 thick
// expect: ok each level is 0.7 as long and 0.8 as thick: the two branches off the trunk
// expect: ok the first branch off the trunk leans right (angle + 0.4 from straight up), the second left
// expect: ok at growth 0 every branch has no length, and the leaves sit on the root
// expect: ok growth takes three seconds; the sway is 0.015 radian a second
// expect: ok twenty particles to start, at the emitter
// expect: ok the same seed is the same particles, another seed is not
// expect: ok speeds are 100 to 250 and radii 3 to 6
// expect: ok half a second on (31 steps of 16 ms): a particle every 0.05 s joined them, nine of them
// expect: ok lifetime falls by half a unit a second
// expect: ok gravity has pulled them down: the average vertical speed rose by about 200 x 0.5 s
// expect: ok after two seconds the first twenty are gone (lifetime 2 s), and the count settles
// expect: ok a burst adds thirty at the click
// expect: ok the generator repeats and stays in [0, 1)
