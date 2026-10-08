// sae:noise -- value noise and Perlin-alike gradient noise in one and two
// dimensions, fractal sums of either (FBM), and a seeded random stream, for
// terrain, textures, wobble and anything else that wants smooth randomness.
//
//   import { noise, perlin2, fbm2 } from "sae:noise";
//   const n = noise(7);                   // everything below, fixed to seed 7
//   n.perlin2(x * 0.05, y * 0.05)         // -1 .. 1, smooth in x and y
//   n.fbm2(x, y, { octaves: 5 })          // -1 .. 1, rougher
//   n.value1(t)                           // 0 .. 1, smooth in t
//   n.random()                            // 0 .. 1, the next of its stream
//
// The free functions take the seed as their last argument (0 if left out).
// Every value is a pure function of its arguments and the seed: the same
// inputs give the same number on every machine, so a page can regenerate a
// world from one small number. Integer lattice points hash to the same value
// however they are reached (no permutation table to wrap at 256).
//
// Idea credit: Cosyne's noise library (Tsyne) for the shape of a page-side
// library; the code here is sae's own.

export interface FbmOptions {
  octaves?: number;       // layers of noise, 4 if left out
  persistence?: number;   // amplitude of each layer relative to the last, 0.5
  lacunarity?: number;    // frequency of each layer relative to the last, 2
}

export interface Noise {
  seed: number;
  random(): number;
  value1(x: number): number;
  value2(x: number, y: number): number;
  perlin1(x: number): number;
  perlin2(x: number, y: number): number;
  fbm1(x: number, o?: FbmOptions): number;
  fbm2(x: number, y: number, o?: FbmOptions): number;
}

// A 32-bit integer mixed into a well-spread 32-bit integer.
function mix(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// The hash of lattice point (x, y) under a seed, in [0, 1).
export function hash2(x: number, y: number, seed: number = 0): number {
  const h = mix((Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77) ^ Math.imul(seed | 0, 0x27d4eb2f)) | 0);
  return h / 4294967296;
}

export function hash1(x: number, seed: number = 0): number {
  return hash2(x, 0x5bd1e995, seed);
}

// Perlin's quintic fade: 0 at 0, 1 at 1, flat at both ends.
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Value noise: the lattice points hold random values, blended between.
export function value1(x: number, seed: number = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash1(i, seed), hash1(i + 1, seed), fade(f));
}

export function value2(x: number, y: number, seed: number = 0): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = fade(x - i);
  const fy = fade(y - j);
  const top = lerp(hash2(i, j, seed), hash2(i + 1, j, seed), fx);
  const bottom = lerp(hash2(i, j + 1, seed), hash2(i + 1, j + 1, seed), fx);
  return lerp(top, bottom, fy);
}

// Gradient noise: the lattice points hold random slopes (1-D) or directions
// (2-D), and the value is 0 at every lattice point. In -1 .. 1.
export function perlin1(x: number, seed: number = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const g0 = hash1(i, seed) * 2 - 1;
  const g1 = hash1(i + 1, seed) * 2 - 1;
  return lerp(g0 * f, g1 * (f - 1), fade(f)) * 2;
}

// The eight unit-ish directions Perlin's 2-D noise picks from.
const DIRS: number[][] = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

function grad2(i: number, j: number, dx: number, dy: number, seed: number): number {
  const d = DIRS[Math.floor(hash2(i, j, seed) * 8) & 7];
  return d[0] * dx + d[1] * dy;
}

export function perlin2(x: number, y: number, seed: number = 0): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const dx = x - i;
  const dy = y - j;
  const fx = fade(dx);
  const fy = fade(dy);
  const top = lerp(grad2(i, j, dx, dy, seed), grad2(i + 1, j, dx - 1, dy, seed), fx);
  const bottom = lerp(grad2(i, j + 1, dx, dy - 1, seed), grad2(i + 1, j + 1, dx - 1, dy - 1, seed), fx);
  // the corner dot products reach +-sqrt(2); scale to -1 .. 1
  return lerp(top, bottom, fy) * 0.7071067811865476;
}

function fbmOptions(o?: FbmOptions): [number, number, number] {
  const octaves = o && o.octaves !== undefined ? Math.max(1, Math.floor(o.octaves)) : 4;
  const persistence = o && o.persistence !== undefined ? o.persistence : 0.5;
  const lacunarity = o && o.lacunarity !== undefined ? o.lacunarity : 2;
  return [octaves, persistence, lacunarity];
}

// Fractional Brownian motion: layers of gradient noise, each finer and
// fainter than the last, normalised back to -1 .. 1.
export function fbm1(x: number, o?: FbmOptions, seed: number = 0): number {
  const [octaves, persistence, lacunarity] = fbmOptions(o);
  let sum = 0, amp = 1, freq = 1, total = 0;
  for (let k = 0; k < octaves; k++) {
    sum += perlin1(x * freq, seed + k) * amp;
    total += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / total;
}

export function fbm2(x: number, y: number, o?: FbmOptions, seed: number = 0): number {
  const [octaves, persistence, lacunarity] = fbmOptions(o);
  let sum = 0, amp = 1, freq = 1, total = 0;
  for (let k = 0; k < octaves; k++) {
    sum += perlin2(x * freq, y * freq, seed + k) * amp;
    total += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / total;
}

// A seeded random stream in [0, 1): the same seed, the same sequence.
export function random(seed: number = 0): () => number {
  let state = mix(seed | 0) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// All of the above fixed to one seed.
export function noise(seed: number = 0): Noise {
  const next = random(seed);
  return {
    seed,
    random: next,
    value1: (x) => value1(x, seed),
    value2: (x, y) => value2(x, y, seed),
    perlin1: (x) => perlin1(x, seed),
    perlin2: (x, y) => perlin2(x, y, seed),
    fbm1: (x, o) => fbm1(x, o, seed),
    fbm2: (x, y, o) => fbm2(x, y, o, seed),
  };
}
