// examples/playground, headless: the physics of Tsyne's bouncing-ball demo and
// the colour picker and shapes of its interactive-shapes demo (Paul Hammant,
// MIT), with the random numbers chosen by the test.
import { newBalls, stepBall, release, pickRandom, newShapes, COLORS } from "./examples/playground/lib/playground.ts";
import { eq } from "./lib/check.ts";

const q = (v: number) => Math.round(v * 1000) / 1000;
const b = newBalls();
eq("three balls: positions, speeds, radii, colours", b.map((x) => [x.x, x.y, x.vx, x.vy, x.radius, x.color]), [[100, 50, 5, 0, 15, "#FF6B6B"], [250, 50, -3, 0, 20, "#4ECDC4"], [400, 50, 2, 0, 12, "#45B7D1"]]);
stepBall(b[0]);
eq("one tick: gravity 0.3 on vy, then move, then damping 0.95 on both", [q(b[0].x), q(b[0].y), q(b[0].vx), q(b[0].vy)], [105, 50.3, 4.75, 0.285]);
const fall = { x: 100, y: 420, vx: 0, vy: 10, radius: 15, color: "#fff", dragging: false };
stepBall(fall);
eq("it bounces off the floor: put on it (450 - 10 - 15) and reversed at 0.8 of what damping left", [fall.y, q(fall.vy)], [425, q(-(10.3 * 0.95) * 0.8)]);
const wall = { x: 20, y: 200, vx: -10, vy: 0, radius: 15, color: "#fff", dragging: false };
stepBall(wall);
eq("and off the left wall (10 px in)", [wall.x, wall.vx > 0], [25, true]);
const right = { x: 470, y: 200, vx: 10, vy: 0, radius: 15, color: "#fff", dragging: false };
stepBall(right);
eq("and the right wall (490)", [right.x, right.vx < 0], [475, true]);
const top = { x: 200, y: 30, vx: 0, vy: -10, radius: 15, color: "#fff", dragging: false };
stepBall(top);
eq("and the ceiling (10 down)", [top.y, top.vy > 0], [25, true]);
const held = { x: 5, y: 5, vx: 1, vy: 1, radius: 5, color: "#fff", dragging: true };
stepBall(held);
eq("a ball being dragged does not move", [held.x, held.y], [5, 5]);
release(held, () => 0.5);
eq("let go: a flick up, no sideways with the generator at the middle", [held.dragging, held.vx, held.vy], [false, 0, -5]);
release(held, () => 1);
eq("sideways at most 1.5", held.vx, 1.5);
const all = newBalls();
for (let i = 0; i < 2000; i++) all.forEach(stepBall);
eq("two thousand ticks on, every ball is still inside the box and has settled on the floor", all.every((x) => x.x >= 25 - 15 && x.x <= 490 && x.y <= 440 - x.radius + 1e-9 && x.y >= 10 + x.radius), true);
eq("settled: nearly still on the floor", all.map((x) => [Math.abs(x.vy) < 1, q(x.y) === 440 - x.radius]), [[true, true], [true, true], [true, true]]);

eq("the picker never gives the colour it was told to avoid, and takes the others in order", COLORS.map((c) => [0, 0.3, 0.6, 0.99].map((r) => pickRandom(c, () => r)).includes(c)), [false, false, false, false, false]);
eq("with the generator at 0 it gives the first other colour", [pickRandom(COLORS[0], () => 0), pickRandom(COLORS[1], () => 0)], [COLORS[1], COLORS[0]]);
eq("and at 0.99 the fourth other one", pickRandom(COLORS[0], () => 0.99), COLORS[4]);
eq("three shapes: two circles and a rectangle, in Tsyne's places", newShapes().map((s) => [s.id, s.type, s.x, s.y, s.r ?? s.w, s.h ?? 0, s.color]), [["circle1", "circle", 100, 100, 30, 0, "#FF6B6B"], ["circle2", "circle", 300, 150, 25, 0, "#4ECDC4"], ["rect", "rect", 150, 300, 80, 60, "#45B7D1"]]);
// expect: ok three balls: positions, speeds, radii, colours
// expect: ok one tick: gravity 0.3 on vy, then move, then damping 0.95 on both
// expect: ok it bounces off the floor: put on it (450 - 10 - 15) and reversed at 0.8 of what damping left
// expect: ok and off the left wall (10 px in)
// expect: ok and the right wall (490)
// expect: ok and the ceiling (10 down)
// expect: ok a ball being dragged does not move
// expect: ok let go: a flick up, no sideways with the generator at the middle
// expect: ok sideways at most 1.5
// expect: ok two thousand ticks on, every ball is still inside the box and has settled on the floor
// expect: ok settled: nearly still on the floor
// expect: ok the picker never gives the colour it was told to avoid, and takes the others in order
// expect: ok with the generator at 0 it gives the first other colour
// expect: ok and at 0.99 the fourth other one
// expect: ok three shapes: two circles and a rectangle, in Tsyne's places
