// Conditional-format rules, as Excel's Conditional Formatting menu has them
// (the Tauri app's conditional styles, an expression per cell, are notes.ts's
// styleExpression). A rule covers a range: Highlight Cells (a comparison,
// between, text that contains), Top/Bottom (n cells, or n%), Above/Below
// Average, Duplicate or Unique values, a two- or three-colour scale, an
// icon set. applied() works out what each cell of a sheet gets: a style, or
// an icon before its text, or a data bar (a share of the largest number,
// from the cell's end when negative, as the grid's --fill draws it).
import { keyOf, range } from "./address.ts";
import type { Addr } from "./address.ts";
import { show } from "./format.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export type Comparison = ">" | "<" | ">=" | "<=" | "=" | "<>" | "between" | "contains";

export type CfRule = (
  | { readonly kind: "cellValue"; readonly op: Comparison; readonly value: string; readonly value2?: string; readonly style: string }
  | { readonly kind: "top"; readonly n: number; readonly bottom: boolean; readonly percent: boolean; readonly style: string }
  | { readonly kind: "average"; readonly below: boolean; readonly style: string }
  | { readonly kind: "duplicates"; readonly unique: boolean; readonly style: string }
  | { readonly kind: "colorScale"; readonly colors: readonly string[] }
  | { readonly kind: "iconSet"; readonly icons: IconSet }
  | { readonly kind: "dataBar"; readonly color: string }
) & { readonly range: [Addr, Addr] };

export const ICONS = { arrows: ["↑", "→", "↓"], triangles: ["▲", "▬", "▼"], ratings: ["●●●", "●●○", "●○○"] } as const;
export type IconSet = keyof typeof ICONS;

export interface Mark {
  readonly style?: string;
  readonly icon?: string;
}

const NUMBER = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;
const numberOf = (v: Value): number | null => (typeof v === "number" ? v : typeof v === "string" && NUMBER.test(v) ? Number(v) : null);

const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number): string =>
  `#${hex(a).map((x, i) => Math.round(x + (hex(b)[i] - x) * t).toString(16).padStart(2, "0")).join("")}`;

const median = (ns: readonly number[]): number => {
  const s = [...ns].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function compared(op: Comparison, v: Value, a: string, b?: string): boolean {
  const n = numberOf(v), x = Number(a), y = Number(b);
  if (op === "contains") return v !== null && show(v).toLowerCase().includes(a.toLowerCase());
  if (op === "between") return n !== null && n >= Math.min(x, y) && n <= Math.max(x, y);
  if (n === null || isNaN(x)) {
    // Text compares as text, any case.
    if (v === null || v instanceof CellError) return false;
    const s = show(v).toLowerCase(), t = a.toLowerCase();
    return op === "=" ? s === t : op === "<>" ? s !== t : false;
  }
  switch (op) {
    case ">": return n > x;
    case "<": return n < x;
    case ">=": return n >= x;
    case "<=": return n <= x;
    case "=": return n === x;
    default: return n !== x;
  }
}

// What one rule gives the cells of its range.
function marked(rule: CfRule, value: (key: string) => Value): [string, Mark][] {
  const keys = [...range(rule.range[0], rule.range[1])];
  const numbers = keys.map((k) => numberOf(value(k)));
  const ns = numbers.filter((n): n is number => n !== null);
  const styled = (pick: (k: string, i: number) => boolean, style: string): [string, Mark][] =>
    keys.filter(pick).map((k) => [k, { style }]);
  switch (rule.kind) {
    case "cellValue": return styled((k) => compared(rule.op, value(k), rule.value, rule.value2), rule.style);
    case "top": {
      const count = Math.max(1, rule.percent ? Math.floor((ns.length * rule.n) / 100) : rule.n);
      const sorted = [...ns].sort((x, y) => (rule.bottom ? x - y : y - x));
      const edge = sorted[Math.min(count, sorted.length) - 1];
      return styled((_, i) => numbers[i] !== null && (rule.bottom ? numbers[i]! <= edge : numbers[i]! >= edge), rule.style);
    }
    case "average": {
      const mean = ns.reduce((s, n) => s + n, 0) / ns.length;
      return styled((_, i) => numbers[i] !== null && (rule.below ? numbers[i]! < mean : numbers[i]! > mean), rule.style);
    }
    case "duplicates": {
      const text = (k: string) => show(value(k)).toLowerCase();
      const counts = new Map<string, number>();
      for (const k of keys) if (text(k) !== "") counts.set(text(k), (counts.get(text(k)) ?? 0) + 1);
      return styled((k) => text(k) !== "" && (counts.get(text(k))! > 1) !== rule.unique, rule.style);
    }
    case "colorScale": {
      if (!ns.length) return [];
      const lo = Math.min(...ns), hi = Math.max(...ns), mid = median(ns);
      const [a, b, c] = rule.colors;
      const at = (n: number): string => {
        if (!c) return mix(a, b, hi === lo ? 0 : (n - lo) / (hi - lo));
        return n <= mid ? mix(a, b, mid === lo ? 0 : (n - lo) / (mid - lo)) : mix(b, c, hi === mid ? 1 : (n - mid) / (hi - mid));
      };
      return keys.flatMap((k, i): [string, Mark][] => (numbers[i] === null ? [] : [[k, { style: `background: ${at(numbers[i]!)}` }]]));
    }
    case "dataBar": {
      const most = Math.max(...ns.map(Math.abs));
      if (!most) return [];
      return keys.flatMap((k, i): [string, Mark][] => (numbers[i] === null ? []
        : [[k, { style: `--fill: ${Number((numbers[i]! / most).toFixed(4))}; --fill-color: ${rule.color}` }]]));
    }
    case "iconSet": {
      if (!ns.length) return [];
      const lo = Math.min(...ns), hi = Math.max(...ns), [up, level, down] = ICONS[rule.icons];
      return keys.flatMap((k, i): [string, Mark][] => {
        const n = numbers[i];
        if (n === null) return [];
        const t = hi === lo ? 1 : (n - lo) / (hi - lo);
        return [[k, { icon: t >= 0.67 ? up : t >= 0.33 ? level : down }]];
      });
    }
  }
}

// Every rule's marks, by cell; where two rules mark a cell, the first rule
// listed wins (its style comes last, and its icon is the one shown).
export function applied(rules: readonly CfRule[], value: (key: string) => Value): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const rule of [...rules].reverse()) {
    for (const [k, m] of marked(rule, value)) {
      const was = out.get(k) ?? {};
      out.set(k, { ...was, ...(m.style ? { style: was.style ? `${was.style}; ${m.style}` : m.style } : {}), ...(m.icon ? { icon: m.icon } : {}) });
    }
  }
  return out;
}

export const rangeName = ([a, b]: readonly [Addr, Addr]): string => (keyOf(a) === keyOf(b) ? keyOf(a) : `${keyOf(a)}:${keyOf(b)}`);

// What a rule does, as Manage Rules lists it.
export function describeRule(rule: CfRule): string {
  const what = (() => {
    switch (rule.kind) {
      case "cellValue":
        return rule.op === "between" ? `cell value between ${rule.value} and ${rule.value2}` : rule.op === "contains" ? `text contains ${rule.value}` : `cell value ${rule.op} ${rule.value}`;
      case "top": return `${rule.bottom ? "bottom" : "top"} ${rule.n}${rule.percent ? "%" : ""}`;
      case "average": return `${rule.below ? "below" : "above"} average`;
      case "duplicates": return `${rule.unique ? "unique" : "duplicate"} values`;
      case "colorScale": return `colour scale ${rule.colors.join(", ")}`;
      case "iconSet": return `icon set ${rule.icons}`;
      case "dataBar": return `data bars ${rule.color}`;
    }
  })();
  return `${rangeName(rule.range)}: ${what}`;
}
