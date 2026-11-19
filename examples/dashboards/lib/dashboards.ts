// SPDX-License-Identifier: MIT
// What the gauge and dial dashboards compute: the metrics of Tsyne's
// phone-apps/gauge-dashboard/gauge-cosyne.ts and the dial settings of
// phone-apps/dial-dashboard/dial-cosyne.ts (at ae3b8d44), Copyright (c) 2025
// Paul Hammant, MIT (see ../NOTICE.md). Changes: each metric is a function of
// a time t in seconds (Tsyne's read Date.now() each call), and the network's
// random jitter is a fixed wobble of t, so a held t gives the same dashboard.
// The arc geometry is written here: Tsyne's gauge and dial are Cosyne
// primitives, which are not taken.

// ---------- gauges ----------

export interface GaugeSpec {
  label: string;
  start?: number;   // degrees, counter-clockwise from the right (the maths way); default 225
  end?: number;     // default 315
  color: string;
  radius?: number;  // default 35 (30 for the orientation row)
  value: (t: number) => number;
}

export const SYSTEM: GaugeSpec[] = [
  { label: "CPU", color: "#3498db", value: (t) => { const base = 30 + Math.sin(t * 0.3) * 20; const spike = Math.sin(t * 2.3) > 0.8 ? 40 : 0; return Math.min(100, base + spike); } },
  { label: "Memory", color: "#2ecc71", value: (t) => 40 + ((t % 6) / 6) * 50 + Math.sin(t * 1.2) * 10 },
  { label: "Disk", color: "#e67e22", value: (t) => 65 + Math.sin(t * 0.2) * 5 },
  { label: "Network", color: "#9b59b6", value: (t) => Math.min(100, (Math.abs(Math.sin(t * 3)) > 0.6 ? 80 : 20) + ((t * 37) % 1) * 10) },
];

export const ORIENTATION: GaugeSpec[] = [
  { label: "Top", start: 45, end: 135, color: "#16a085", radius: 30, value: (t) => 50 + Math.cos(t * 0.7) * 45 },
  { label: "Left", start: 135, end: 225, color: "#c0392b", radius: 30, value: (t) => 30 + Math.abs(Math.sin(t * 0.3)) * 60 },
  { label: "Right", start: -45, end: 45, color: "#8e44ad", radius: 30, value: (t) => (t * 20) % 100 },
  { label: "3/4", start: 135, end: 45, color: "#d35400", radius: 30, value: (t) => 50 + Math.sin(t * 1.2) * 30 + Math.sin(t * 0.4) * 15 },
  { label: "Full", start: 90, end: 450, color: "#27ae60", radius: 30, value: (t) => 75 + Math.sin(t * 0.8) * 20 },
];

export const SIZES: GaugeSpec[] = [
  { label: "Speed", start: 180, end: 0, color: "#e74c3c", radius: 50, value: (t) => 20 + Math.abs(Math.sin(t * 0.5)) * 70 },
  { label: "Temp", start: 225, end: 315, color: "#f39c12", radius: 35, value: (t) => 45 + Math.sin(t * 0.15) * 25 },
  { label: "Batt", start: 225, end: 315, color: "#2ecc71", radius: 20, value: (t) => 50 + Math.sin(t * 0.1) * 45 },
  { label: "Progress", start: 150, end: 30, color: "#3498db", radius: 30, value: (t) => (t * 8) % 100 },
];

/** A gauge's sweep in degrees, counter-clockwise from its start: end - start, wrapped to 1..360 (a full circle is 360). */
export function gaugeSweep(start: number, end: number): number {
  let s = end - start;
  while (s <= 0) s += 360;
  while (s > 360) s -= 360;
  return s === 0 ? 360 : s;
}

/** A point at `deg` degrees on a circle: counter-clockwise from the right with the y axis up (the maths way, as the gauges' angles are) or clockwise on screen (the dials'). */
export function polar(cx: number, cy: number, r: number, deg: number, ccw: boolean): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), ccw ? cy - r * Math.sin(a) : cy + r * Math.sin(a)];
}

const f = (v: number): string => String(Math.round(v * 100) / 100);

/** An arc's path data from `start` through `sweep` degrees (positive: the way the angles count). */
export function arcD(cx: number, cy: number, r: number, start: number, sweep: number, ccw: boolean): string {
  if (sweep >= 359.999) {
    const [x1, y1] = polar(cx, cy, r, start, ccw), [x2, y2] = polar(cx, cy, r, start + 180, ccw);
    return `M${f(x1)} ${f(y1)} A${r} ${r} 0 1 1 ${f(x2)} ${f(y2)} A${r} ${r} 0 1 1 ${f(x1)} ${f(y1)}`;
  }
  const [x1, y1] = polar(cx, cy, r, start, ccw), [x2, y2] = polar(cx, cy, r, start + sweep, ccw);
  // SVG's sweep flag is 1 for clockwise on screen: counting counter-clockwise (maths) is 0
  return `M${f(x1)} ${f(y1)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} ${ccw ? 0 : 1} ${f(x2)} ${f(y2)}`;
}

// ---------- dials ----------

export interface DialSpec {
  id: string;
  label: string;
  x: number; y: number;           // centre
  min: number; max: number; value: number;
  style?: "classic" | "minimal" | "vintage" | "modern";
  radius: number;
  start?: number; end?: number;   // degrees clockwise from the right on screen; default 135 to 405, a 270 degree knob with its gap at the bottom
  step?: number;
  decimals?: number;
  suffix?: string;
  ticks?: number; majorEvery?: number;
  accent?: string; track?: string; knob?: string; indicator?: string; text?: string;
  showValue?: boolean;
}

export const DIALS: DialSpec[] = [
  { id: "volume", label: "Volume", x: 70, y: 85, min: 0, max: 100, value: 50, style: "classic", radius: 35, suffix: "%", ticks: 11 },
  { id: "brightness", label: "Brightness", x: 180, y: 85, min: 0, max: 100, value: 65, style: "minimal", radius: 35, suffix: "%", ticks: 5 },
  { id: "temp", label: "Temp", x: 300, y: 85, min: 15, max: 30, value: 21.5, style: "vintage", radius: 35, suffix: "°", decimals: 1, step: 0.5, ticks: 16, majorEvery: 5 },
  { id: "speed", label: "Speed", x: 420, y: 85, min: 0, max: 100, value: 75, style: "modern", radius: 35, ticks: 11 },
  { id: "hue", label: "Hue (360°)", x: 70, y: 250, min: 0, max: 360, value: 180, start: 0, end: 360, radius: 35, accent: "#ff6b6b", track: "#eeeeee", knob: "#ffffff", suffix: "°", ticks: 13, majorEvery: 3 },
  { id: "angle", label: "Angle (180°)", x: 180, y: 250, min: 0, max: 180, value: 90, start: -180, end: 0, radius: 35, accent: "#9b59b6", track: "#e0e0e0", suffix: "°", ticks: 7 },
  { id: "pan", label: "Pan (L/R)", x: 300, y: 250, min: -100, max: 100, value: 0, radius: 35, accent: "#27ae60", track: "#cccccc", ticks: 21, majorEvery: 5 },
  { id: "gain", label: "Gain", x: 420, y: 250, min: 0, max: 10, value: 5, radius: 35, accent: "#e74c3c", track: "#fadbd8", knob: "#fdfefe", indicator: "#c0392b", text: "#c0392b", decimals: 1 },
  { id: "small", label: "Small", x: 70, y: 400, min: 0, max: 100, value: 30, style: "classic", radius: 20, showValue: false, ticks: 5 },
  { id: "medium", label: "Medium", x: 180, y: 400, min: 0, max: 100, value: 60, style: "minimal", radius: 30, ticks: 9 },
  { id: "large", label: "Large", x: 300, y: 400, min: 0, max: 100, value: 80, style: "classic", radius: 40, ticks: 11 },
  { id: "bound", label: "Bound", x: 420, y: 400, min: 0, max: 100, value: 0, style: "modern", radius: 35, accent: "#f39c12" },
];

/** The style presets' colours. */
export const STYLES: { [k: string]: { accent: string; track: string; knob: string; indicator: string; text: string } } = {
  classic: { accent: "#3498db", track: "#d5d8dc", knob: "#ecf0f1", indicator: "#2c3e50", text: "#2c3e50" },
  minimal: { accent: "#34495e", track: "#ecf0f1", knob: "#ffffff", indicator: "#34495e", text: "#34495e" },
  vintage: { accent: "#a0522d", track: "#e8d9c0", knob: "#f5e6c8", indicator: "#5c4033", text: "#5c4033" },
  modern: { accent: "#1abc9c", track: "#3a3a3a", knob: "#2b2b2b", indicator: "#ffffff", text: "#ffffff" },
};

export const dialStart = (d: DialSpec): number => d.start ?? 135;
export const dialEnd = (d: DialSpec): number => d.end ?? 405;

/** The dial's value, 0 to 1 along its range. */
export const dialFraction = (d: DialSpec, v: number): number => (v - d.min) / (d.max - d.min);

/** The angle (degrees, clockwise from the right) of the indicator at value v. */
export const dialAngle = (d: DialSpec, v: number): number => dialStart(d) + dialFraction(d, v) * (dialEnd(d) - dialStart(d));

/** The value a pointer at (px, py) means for a dial centred at (d.x, d.y): the angle is kept on the dial's sweep (the gap goes to the nearer end) and snapped to the step. */
export function dialValueAt(d: DialSpec, px: number, py: number): number {
  const sweep = dialEnd(d) - dialStart(d);
  let rel = ((Math.atan2(py - d.y, px - d.x) * 180) / Math.PI - dialStart(d)) % 360;
  if (rel < 0) rel += 360;
  let fr: number;
  if (sweep >= 360 || rel <= sweep) fr = rel / sweep;
  else fr = rel - sweep < (360 - sweep) / 2 ? 1 : 0;
  const step = d.step ?? (d.max - d.min >= 50 ? 1 : (d.max - d.min) / 100);
  const v = d.min + Math.round((fr * (d.max - d.min)) / step) * step;
  return Math.max(d.min, Math.min(d.max, Math.round(v * 1000) / 1000));
}

export const dialText = (d: DialSpec, v: number): string => `${v.toFixed(d.decimals ?? 0)}${d.suffix ?? ""}`;
