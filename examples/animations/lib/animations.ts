// SPDX-License-Identifier: MIT
// What the three animations compute, from Tsyne's phone-apps/spinner/
// spinner-cosyne.ts, fractal-tree/fractal-tree-cosyne.ts and
// particles/particles-cosyne.ts (at ae3b8d44), Copyright (c) 2025 Paul
// Hammant, MIT (see ../NOTICE.md): the spinner's segment alpha, the tree's
// recursion, the particles' physics and spawn rate. Changes: time is an
// argument, not Date.now(); the particles draw from a seeded generator, so a
// run is repeatable (Tsyne used Math.random); the tree returns its lines and
// leaves as data instead of drawing them.

// ---------- spinner ----------

export const SPINNER_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"];

/** The rotation in radians at t seconds: a full turn a second. */
export const spinnerRotation = (t: number): number => t * Math.PI * 2;

/** Segment i's alpha: 1 under the sweep, down to 0.2 away from it. */
export function segmentAlpha(i: number, t: number): number {
  const segmentAngle = (i / 8) * Math.PI * 2;
  const angleDiff = Math.abs(((spinnerRotation(t) - segmentAngle) % (Math.PI * 2)) - Math.PI);
  return Math.max(0.2, 1 - angleDiff / Math.PI);
}

// ---------- fractal tree ----------

export interface Branch { x1: number; y1: number; x2: number; y2: number; thickness: number; depth: number }
export interface Leaf { x: number; y: number }

/** 0 to 1 over the first three seconds. */
export const growthPhase = (t: number): number => Math.min(1, t / 3);
/** The wind's slow turn, in radians of sway. */
export const swayAngle = (t: number): number => t * 0.3 * 0.05;

/** Tsyne's tree: five levels from (200, 400) straight up, each 0.7 as long and 0.8 as thick, branching 0.4 radian either way, a leaf at every tip. */
export function tree(growth: number): { branches: Branch[]; leaves: Leaf[] } {
  const branches: Branch[] = [], leaves: Leaf[] = [];
  const draw = (x: number, y: number, angle: number, depth: number, length: number, thickness: number): void => {
    if (depth === 0 || length < 2) { leaves.push({ x, y }); return; }
    const animated = length * growth;
    const ex = x + Math.cos(angle) * animated, ey = y + Math.sin(angle) * animated;
    branches.push({ x1: x, y1: y, x2: ex, y2: ey, thickness, depth });
    draw(ex, ey, angle + 0.4, depth - 1, length * 0.7, thickness * 0.8);
    draw(ex, ey, angle - 0.4, depth - 1, length * 0.7, thickness * 0.8);
  };
  draw(200, 400, -Math.PI / 2, 5, 60, 6);
  return { branches, leaves };
}

// ---------- particles ----------

export interface Particle { id: number; x: number; y: number; vx: number; vy: number; lifetime: number; radius: number; color: string }
export const PARTICLE_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#FF69B4"];

/** A small seeded generator (mulberry32): the same seed, the same run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ParticleSystem {
  particles: Particle[] = [];
  private nextId = 0;
  private sinceSpawn = 0;
  private rand: () => number;

  /** Starts with 20 particles from the emitter at (200, 250). */
  constructor(seed: number = 1) {
    this.rand = seeded(seed);
    for (let i = 0; i < 20; i++) this.spawn(200, 250);
  }

  spawn(x: number, y: number): void {
    const angle = this.rand() * Math.PI * 2;
    const speed = 100 + this.rand() * 150;
    this.particles.push({
      id: this.nextId++, x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      lifetime: 1.0,
      radius: 3 + this.rand() * 3,
      color: PARTICLE_COLORS[Math.floor(this.rand() * PARTICLE_COLORS.length)],
    });
  }

  /** A burst of n at a point (the demo says "click to burst"). */
  burst(x: number, y: number, n: number = 30): void { for (let i = 0; i < n; i++) this.spawn(x, y); }

  /** dt seconds on: a new particle every 0.05 s, gravity 200, air resistance 0.98 a step, lifetime 2 s, gone when dead or below 500. */
  update(dt: number): void {
    this.sinceSpawn += dt;
    if (this.sinceSpawn >= 0.05) { this.spawn(200, 250); this.sinceSpawn -= 0.05; }
    const gravity = 200;
    this.particles = this.particles
      .map((p) => {
        const vy = p.vy + gravity * dt;
        const vx = p.vx * 0.98;
        return { ...p, x: p.x + vx * dt, y: p.y + vy * dt, vx, vy, lifetime: p.lifetime - dt * 0.5 };
      })
      .filter((p) => p.lifetime > 0 && p.y < 500);
  }
}
