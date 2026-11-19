// SPDX-License-Identifier: MIT
// What the three chart views compute. The bar values and the heat map's
// sine field, and its viridis-like colour ramp, are the formulas of Tsyne's
// phone-apps/bar-chart/bar-chart-cosyne.ts and heatmap-demo/heatmap-cosyne.ts
// (at ae3b8d44), Copyright (c) 2025 Paul Hammant, MIT (see ../NOTICE.md); the
// line chart's data is from phone-apps/line-chart-demo/line-chart-demo.ts.
// The line interpolations (linear, step, Catmull-Rom, monotone) are written
// here from the standard constructions: Tsyne's come from its Cosyne library,
// which is not taken.

export const BAR_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F"];
export const BAR_LABELS = ["Series A", "Series B", "Series C", "Series D", "Series E", "Series F"];

/** Bar i at time t (seconds): each oscillates with its own frequency and phase. */
export function barValue(i: number, t: number, shift: number = 0): number {
  const frequency = 0.5 + i * 0.1;
  const phase = (i / 6) * Math.PI * 2 + shift;
  return 50 + i * 20 + Math.sin(t * frequency + phase) * 40;
}

/** The axis maximum: the tallest bar, but at least 100. */
export const barMax = (values: number[]): number => Math.max(...values, 100);

/** The heat map's cell at (row, col) of an 8 by 8 grid, at time t, 0 to 100. */
export function heatValue(row: number, col: number, t: number): number {
  const frequency = 0.5 + (row + col) * 0.1;
  const phase = (row * 8 + col) * 0.1;
  return Math.max(0, Math.min(100, 50 + Math.sin(t * frequency + phase) * 40));
}

/** A value from 0 to 100 as the demo's purple, green, yellow ramp: [r, g, b]. */
export function viridis(value: number): [number, number, number] {
  const n = (value - 0) / (100 - 0);
  if (n < 0.33) {
    const t = n / 0.33;
    return [Math.floor(68 + 31 * t), Math.floor(1 + 110 * t), Math.floor(84 - 84 * t)];
  } else if (n < 0.67) {
    const t = (n - 0.33) / 0.34;
    return [Math.floor(99 + 87 * t), Math.floor(111 + 105 * t), 0];
  }
  const t = (n - 0.67) / 0.33;
  return [Math.floor(186 + 69 * t), Math.floor(216 - 94 * t), Math.floor(46 * t)];
}

export const rgbCss = (c: [number, number, number]): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export interface Pt { x: number; y: number }

// Tsyne's demo's data: a series, and the same shifted up and down 15.
export const DATA1: Pt[] = [
  { x: 0, y: 50 }, { x: 10, y: 68 }, { x: 20, y: 79 }, { x: 30, y: 75 }, { x: 40, y: 58 }, { x: 50, y: 42 },
  { x: 60, y: 35 }, { x: 70, y: 45 }, { x: 80, y: 62 }, { x: 90, y: 78 }, { x: 100, y: 80 },
];
export const DATA2: Pt[] = DATA1.map((p) => ({ x: p.x, y: p.y + 15 }));
export const DATA3: Pt[] = DATA1.map((p) => ({ x: p.x, y: p.y - 15 }));

export type Interpolation = "linear" | "step" | "catmull-rom" | "monotone";
export const INTERPOLATIONS: Interpolation[] = ["linear", "step", "catmull-rom", "monotone"];

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/** SVG path data through points (already in canvas coordinates). */
export function linePath(p: Pt[], how: Interpolation): string {
  if (p.length === 0) return "";
  let d = `M${f(p[0].x)} ${f(p[0].y)}`;
  const n = p.length;
  if (how === "linear") {
    for (let i = 1; i < n; i++) d += ` L${f(p[i].x)} ${f(p[i].y)}`;
  } else if (how === "step") {
    for (let i = 1; i < n; i++) {
      const mx = (p[i - 1].x + p[i].x) / 2;
      d += ` L${f(mx)} ${f(p[i - 1].y)} L${f(mx)} ${f(p[i].y)}`;
    }
    d += ` L${f(p[n - 1].x)} ${f(p[n - 1].y)}`;
  } else if (how === "catmull-rom") {
    for (let i = 0; i < n - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(n - 1, i + 2)];
      d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
    }
  } else {
    // monotone: Fritsch-Carlson tangents, so the curve never overshoots its points
    const s: number[] = [], m: number[] = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) s.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x));
    if (n > 1) { m[0] = s[0]; m[n - 1] = s[n - 2]; }
    for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b;
      if (h > 9) { const tau = 3 / Math.sqrt(h); m[i] = tau * a * s[i]; m[i + 1] = tau * b * s[i]; }
    }
    for (let i = 0; i < n - 1; i++) {
      const dx = (p[i + 1].x - p[i].x) / 3;
      d += ` C${f(p[i].x + dx)} ${f(p[i].y + dx * m[i])} ${f(p[i + 1].x - dx)} ${f(p[i + 1].y - dx * m[i + 1])} ${f(p[i + 1].x)} ${f(p[i + 1].y)}`;
    }
  }
  return d;
}

/** Zoom and pan of the line chart: scale 0.5 to 5, as in Tsyne's demo. */
export interface ZoomPan { scale: number; tx: number; ty: number }
export const zoomed = (z: ZoomPan, steps: number): ZoomPan => ({ ...z, scale: Math.max(0.5, Math.min(5, z.scale * Math.pow(1.15, steps))) });
export const panned = (z: ZoomPan, dx: number, dy: number): ZoomPan => ({ ...z, tx: z.tx + dx, ty: z.ty + dy });
