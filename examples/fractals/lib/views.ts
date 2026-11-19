// SPDX-License-Identifier: BSD-3-Clause
// The five explorers' starting views, iteration limits and Julia presets,
// gathered from Tsyne's phone-apps/mandelbrot, julia-set, newton-fractal,
// tricorn and burning-ship (at ae3b8d44), Copyright (c) 2025 Paul Hammant
// (see ../NOTICE.md), where each app repeated them. The view arithmetic
// (scale, tap zoom, scroll zoom, pan) is theirs too, in one place.
import { mandelbrot, julia, newton, tricorn, burningShip } from "./fractal-utils.ts";

export interface Kind {
  name: string;
  centerX: number;
  centerY: number;
  zoom: number;
  maxIter: number;
  iterate: (cx: number, cy: number, maxIter: number, cr: number, ci: number) => number;
}

export const KINDS: Kind[] = [
  { name: "Mandelbrot", centerX: -0.5, centerY: 0, zoom: 1, maxIter: 256, iterate: (x, y, n) => mandelbrot(x, y, n) },
  { name: "Julia set", centerX: 0, centerY: 0, zoom: 1.5, maxIter: 256, iterate: (x, y, n, cr, ci) => julia(x, y, n, cr, ci) },
  { name: "Newton fractal", centerX: 0, centerY: 0, zoom: 2, maxIter: 64, iterate: (x, y, n) => newton(x, y, n) },
  { name: "Tricorn", centerX: -0.3, centerY: 0, zoom: 1, maxIter: 256, iterate: (x, y, n) => tricorn(x, y, n) },
  { name: "Burning Ship", centerX: -0.4, centerY: -0.6, zoom: 0.8, maxIter: 256, iterate: (x, y, n) => burningShip(x, y, n) },
];

// Famous Julia set c values
export const PRESETS = [
  { name: "Classic", cr: -0.4, ci: 0.6 },
  { name: "Dendrite", cr: 0, ci: 1 },
  { name: "Spiral", cr: -0.8, ci: 0.156 },
  { name: "Rabbit", cr: -0.123, ci: 0.745 },
  { name: "Dragon", cr: -0.7269, ci: 0.1889 },
  { name: "Siegel", cr: -0.391, ci: -0.587 },
];

export interface View { centerX: number; centerY: number; zoom: number }

/** Complex-plane units per pixel: 3 across the smaller side at zoom 1. */
export const scaleOf = (v: View, w: number, h: number): number => 3 / (Math.min(w, h) * v.zoom);

/** The point of the plane under pixel (px, py). */
export function pointAt(v: View, w: number, h: number, px: number, py: number): [number, number] {
  const s = scaleOf(v, w, h);
  return [v.centerX + (px - w / 2) * s, v.centerY + (py - h / 2) * s];
}

/** A tap: centre on the tapped point and zoom in twice as far. */
export function tapZoom(v: View, w: number, h: number, px: number, py: number): View {
  const [cx, cy] = pointAt(v, w, h, px, py);
  return { centerX: cx, centerY: cy, zoom: v.zoom * 2 };
}

/** A scroll step: 10% in or out, the point under the cursor staying put. */
export function scrollZoom(v: View, w: number, h: number, px: number, py: number, deltaY: number): View {
  const [cx, cy] = pointAt(v, w, h, px, py);
  const zoom = Math.max(0.5, Math.min(v.zoom * (deltaY > 0 ? 1.1 : 0.9), 100000));
  const s = 3 / (Math.min(w, h) * zoom);
  return { centerX: cx - (px - w / 2) * s, centerY: cy - (py - h / 2) * s, zoom };
}

export const zoomIn = (v: View): View => ({ ...v, zoom: v.zoom * 2 });
export const zoomOut = (v: View): View => ({ ...v, zoom: Math.max(0.5, v.zoom / 2) });

/** A pan button: 50 pixels a step. */
export function pan(v: View, w: number, h: number, dx: number, dy: number): View {
  const s = scaleOf(v, w, h);
  return { ...v, centerX: v.centerX + dx * s * 50, centerY: v.centerY + dy * s * 50 };
}
