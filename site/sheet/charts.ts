// Charts laid out with no toolkit, as GridCraft's chart crate lays them out:
// a range read as categories and series (chartData), a scale with round
// ticks (niceScale), and a bar, line or pie chart as plain shapes (layout)
// that the page draws in vg and a spec can read back. And sparklines, as
// text a cell can hold: eight heights of block.
import { range } from "./address.ts";
import type { Addr } from "./address.ts";
import { show } from "./format.ts";
import type { Value } from "./values.ts";

export type ChartKind = "bar" | "line" | "pie";
export const CHART_KINDS: readonly ChartKind[] = ["bar", "line", "pie"];

// Office's palette, series by series.
export const PALETTE = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"];

export interface Series {
  readonly name: string;
  readonly values: readonly number[];
}

export interface ChartData {
  readonly labels: readonly string[];
  readonly series: readonly Series[];
}

export type Shape =
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly fill: string }
  | { readonly kind: "line"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly stroke: string; readonly width: number }
  | { readonly kind: "polyline"; readonly points: readonly number[]; readonly stroke: string; readonly width: number }
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number; readonly fill: string }
  | { readonly kind: "path"; readonly d: string; readonly fill: string; readonly stroke: string }
  | { readonly kind: "text"; readonly x: number; readonly y: number; readonly size: number; readonly anchor: "start" | "middle" | "end"; readonly text: string; readonly fill: string };

const NUMBER = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;
const isNumber = (v: Value) => typeof v === "number" || (typeof v === "string" && NUMBER.test(v));
const numberOf = (v: Value): number => (isNumber(v) ? Number(v) : 0);
const isText = (v: Value) => v !== null && !isNumber(v);

// A range as Excel reads one for a chart: when its first column is text
// below its first row, those are the categories; when its first row is text
// (or empty) beside them, those name the series; each other column is a
// series, anything not a number in it 0.
export function chartData([a, b]: [Addr, Addr], value: (key: string) => Value): ChartData {
  const keys = [...range(a, b)], cols = Math.abs(a.col - b.col) + 1;
  const grid = Array.from({ length: keys.length / cols }, (_, r) => keys.slice(r * cols, (r + 1) * cols).map(value));
  const labelled = cols > 1 && grid.slice(1).some((row) => isText(row[0]));
  const headed = grid.length > 1 && grid[0].slice(labelled ? 1 : 0).some(isText);
  const rows = headed ? grid.slice(1) : grid;
  const first = labelled ? 1 : 0;
  return {
    labels: rows.map((row, i) => (labelled ? show(row[0]) : String(i + 1))),
    series: grid[0].slice(first).map((h, j) => ({
      name: headed ? show(h) : `Series ${j + 1}`,
      values: rows.map((row) => numberOf(row[first + j])),
    })),
  };
}

const tidy = (n: number) => Number(n.toPrecision(12));

// A scale from lo to hi (0 included) in round steps: 1, 2 or 5 times a
// power of ten, about five of them.
export function niceScale(lo: number, hi: number): { lo: number; hi: number; step: number } {
  let a = Math.min(0, lo), b = Math.max(0, hi);
  if (a === b) b = a + 1;
  const rough = (b - a) / 5, mag = 10 ** Math.floor(Math.log10(rough));
  const step = tidy(([1, 2, 5, 10].find((m) => m * mag >= rough - 1e-12) ?? 10) * mag);
  return { lo: tidy(Math.floor(a / step + 1e-9) * step), hi: tidy(Math.ceil(b / step - 1e-9) * step), step };
}

const text = (x: number, y: number, s: string, anchor: "start" | "middle" | "end" = "middle", size = 10, fill = "#404040"): Shape =>
  ({ kind: "text", x, y, size, anchor, text: s, fill });

// A row of swatches and names under the plot.
function legend(names: readonly string[], x: number, y: number): Shape[] {
  const out: Shape[] = [];
  for (const [i, name] of names.entries()) {
    out.push({ kind: "rect", x, y: y - 9, w: 10, h: 10, fill: PALETTE[i % PALETTE.length] });
    out.push(text(x + 14, y, name, "start"));
    x += 24 + name.length * 6;
  }
  return out;
}

function axes(kind: "bar" | "line", data: ChartData, w: number, h: number, title: string): Shape[] {
  const all = data.series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(...all, 0), Math.max(...all, 0));
  const x0 = 40, x1 = w - 10, y0 = title ? 28 : 12, y1 = h - (data.series.length > 1 ? 40 : 24);
  const yOf = (v: number) => y1 - ((v - scale.lo) / (scale.hi - scale.lo)) * (y1 - y0);
  const band = (x1 - x0) / Math.max(1, data.labels.length);
  const out: Shape[] = title ? [text(w / 2, 16, title, "middle", 13)] : [];
  const ticks: Shape[] = [];
  for (let t = scale.lo; t <= scale.hi + scale.step / 2; t = tidy(t + scale.step)) {
    out.push({ kind: "line", x1: x0, y1: yOf(t), x2: x1, y2: yOf(t), stroke: t === 0 ? "#808080" : "#d9d9d9", width: 1 });
    ticks.push(text(x0 - 4, yOf(t) + 3, show(t), "end"));
  }
  out.push(...ticks);
  data.series.forEach((s, j) => {
    const colour = PALETTE[j % PALETTE.length];
    if (kind === "bar") return;
    const points = s.values.flatMap((v, i) => [x0 + (i + 0.5) * band, yOf(v)]);
    out.push({ kind: "polyline", points, stroke: colour, width: 2 });
    for (let i = 0; i < points.length; i += 2) out.push({ kind: "circle", cx: points[i], cy: points[i + 1], r: 2.5, fill: colour });
  });
  if (kind === "bar") {
    const width = (band * 0.8) / Math.max(1, data.series.length);
    data.labels.forEach((_, i) => data.series.forEach((s, j) => {
      const v = s.values[i], top = yOf(Math.max(v, 0)), bottom = yOf(Math.min(v, 0));
      out.push({ kind: "rect", x: x0 + i * band + band * 0.1 + j * width, y: top, w: width, h: bottom - top, fill: PALETTE[j % PALETTE.length] });
    }));
  }
  data.labels.forEach((l, i) => out.push(text(x0 + (i + 0.5) * band, y1 + 14, l)));
  if (data.series.length > 1) out.push(...legend(data.series.map((s) => s.name), x0, h - 8));
  return out;
}

function pie(data: ChartData, w: number, h: number, title: string): Shape[] {
  const values = (data.series[0]?.values ?? []).map((v) => Math.max(0, v));
  const total = values.reduce((s, v) => s + v, 0);
  const top = title ? 28 : 12, bottom = h - 24;
  const r = Math.min(w - 20, bottom - top) / 2, cx = w / 2, cy = (top + bottom) / 2;
  const out: Shape[] = title ? [text(w / 2, 16, title, "middle", 13)] : [];
  const at = (angle: number, radius: number) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];
  const labels: Shape[] = [];
  let angle = 0;
  values.forEach((v, i) => {
    if (!total || !v) return;
    const sweep = (v / total) * 2 * Math.PI, [ax, ay] = at(angle, r), [bx, by] = at(angle + sweep, r);
    const d = sweep >= 2 * Math.PI - 1e-9
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      : `M ${cx} ${cy} L ${ax} ${ay} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${bx} ${by} Z`;
    out.push({ kind: "path", d, fill: PALETTE[i % PALETTE.length], stroke: "#ffffff" });
    const [lx, ly] = at(angle + sweep / 2, r * 0.65);
    labels.push(text(lx, ly + 3, `${Math.round((v / total) * 100)}%`, "middle", 10, "#ffffff"));
    angle += sweep;
  });
  return [...out, ...labels, ...legend(data.labels, 10, h - 8)];
}

// A chart as shapes, in a w x h box.
export function layout(kind: ChartKind, data: ChartData, title: string, w: number, h: number): Shape[] {
  return kind === "pie" ? pie(data, w, h, title) : axes(kind, data, w, h, title);
}

const BLOCKS = "▁▂▃▄▅▆▇█";

// Numbers as a line of blocks, lowest ▁ to highest █ (all alike, ▄).
export function sparkline(ns: readonly number[]): string {
  const lo = Math.min(...ns), hi = Math.max(...ns);
  return ns.map((n) => BLOCKS[hi === lo ? 3 : Math.round(((n - lo) / (hi - lo)) * 7)]).join("");
}
