// Number formats and cell styles, in the dialects the Tauri spreadsheet's
// files use: its own format strings ("bold;color:red;align:center;
// number:0.00", "currency:USD", "percent:0.0%"), Excel-style patterns
// ("$#,##0.00", "0.00%"), CSS objects ({ fontWeight: "bold" }) and the JSON
// of one (what a RexxJS style function gives). A style comes out as the AeCS
// a ui.datagrid cell draws: background, color (hex), font-weight: bold,
// text-align, and (aether-ui 08e3193d) font-style: italic, text-decoration,
// font-size, borders and white-space: normal (wrapped). A cell's look (bold,
// italic, underline, strikethrough, a size, wrapped, borders: notes.ts) is
// set by the format.* commands and drawn by lookStyle.
import { numberFormat } from "./numfmt.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

const CURRENCIES: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", CAD: "CA$", AUD: "A$" };

const COLOURS: Record<string, string> = {
  white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00",
  orange: "#ffa500", grey: "#808080", gray: "#808080", purple: "#800080", pink: "#ffc0cb", brown: "#a52a2a",
};

const grouped = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// n with `places` decimals, in thousands when `group`, with `prefix` and
// `suffix` around it and the sign before them all.
function written(n: number, places: number, group: boolean, prefix = "", suffix = ""): string {
  const [int, frac] = Math.abs(n).toFixed(places).split(".");
  const body = (group ? grouped(int) : int) + (frac ? `.${frac}` : "");
  return `${n < 0 && Number(Math.abs(n).toFixed(places)) !== 0 ? "-" : ""}${prefix}${body}${suffix}`;
}

const placesIn = (pattern: string): number => /\.(0+)/.exec(pattern)?.[1].length ?? 0;

function numberPart(n: number, part: string): string | null {
  const [kind, arg = ""] = part.split(/:(.*)/s);
  switch (kind.trim()) {
    case "number": return written(n, placesIn(arg), arg.includes(","));
    case "currency": {
      const code = arg.trim().toUpperCase() || "USD";
      return written(n, 2, true, CURRENCIES[code] ?? `${code} `);
    }
    case "percent": return written(n * 100, placesIn(arg), false, "", "%");
    default: return /^[^:]*[#0]/.test(part) ? numberFormat(n, part.trim())?.text ?? null : null;
  }
}

// The app's part names: a format with one of these is in its dialect, and
// ';' separates its parts; any other is Excel's number-format language
// (numfmt.ts), where ';' separates sections.
const APP_PART = /^\s*(bold|italic|underline|strikethrough|strike|wrap|(size|border|border-top|border-right|border-bottom|border-left|number|currency|percent|background|background-color|backgroundcolor|bg|color|text-color|font-weight|fontweight|align|text-align|textalign)\s*:)/i;
const appDialect = (format: string): boolean => format.split(";").some((p) => APP_PART.test(p));

// A value as its format writes it, or null when the format does not apply
// (no number format in it, or the value is not a number).
export function formatted(v: Value, format: string): string | null {
  if (!format) return null;
  if (!appDialect(format)) return numberFormat(v, format)?.text ?? null;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : NaN;
  if (isNaN(n) || v instanceof CellError) return null;
  for (const part of format.split(";")) {
    const out = numberPart(n, part);
    if (out !== null) return out;
  }
  return null;
}

function colour(v: string): string | null {
  const c = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${[...c.slice(1)].map((h) => h + h).join("")}`;
  return COLOURS[c] ?? null;
}

// The app's format strings' words for a look.
const WORDS: Record<string, string> = {
  bold: "font-weight: bold", italic: "font-style: italic", underline: "text-decoration: underline",
  strikethrough: "text-decoration: line-through", strike: "text-decoration: line-through", wrap: "white-space: normal",
};

const ALIGN: Record<string, string> = { left: "start", start: "start", center: "center", middle: "center", right: "end", end: "end" };

// One declaration (any dialect's name) as the grid's AeCS, or null.
function declaration(name: string, value: string): string | null {
  switch (name.trim().toLowerCase()) {
    case "background": case "background-color": case "backgroundcolor": case "bg": {
      const c = colour(value);
      return c && `background: ${c}`;
    }
    case "color": case "text-color": {
      const c = colour(value);
      return c && `color: ${c}`;
    }
    case "font-weight": case "fontweight":
      return /^(bold|[7-9]00)$/i.test(value.trim()) ? "font-weight: bold" : null;
    case "align": case "text-align": case "textalign": {
      const a = ALIGN[value.trim().toLowerCase()];
      return a ? `text-align: ${a}` : null;
    }
    case "font-style": case "fontstyle":
      return /^italic$/i.test(value.trim()) ? "font-style: italic" : null;
    case "text-decoration": case "textdecoration": {
      const parts = value.toLowerCase().split(/\s+/).filter((p) => p === "underline" || p === "line-through");
      return parts.length ? `text-decoration: ${parts.join(" ")}` : null;
    }
    case "font-size": case "fontsize": case "size": {
      const n = parseFloat(value);
      return n > 0 ? `font-size: ${n}px` : null;
    }
    case "white-space": case "whitespace":
      return /^normal$/i.test(value.trim()) ? "white-space: normal" : null;
    case "border": case "border-top": case "border-right": case "border-bottom": case "border-left": {
      const width = parseFloat(value) || 1, c = colour(value.trim().split(/\s+/).pop() ?? "");
      return c ? `${name.trim().toLowerCase()}: ${width}px solid ${c}` : null;
    }
    default:
      return null;
  }
}

// The style a format gives a value: the app's style parts, or the colour of
// an Excel section ([Red]).
export function formatStyle(v: Value, format: string): string {
  if (!format) return "";
  if (appDialect(format)) return toStyle(format);
  const c = numberFormat(v, format)?.color;
  return c ? `color: ${c}` : "";
}

// A cell's look, as the format.* commands set it.
export interface Look {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  readonly size?: number;
  readonly wrap?: boolean;
  readonly align?: "start" | "center" | "end";
  readonly borders?: { readonly top?: string; readonly right?: string; readonly bottom?: string; readonly left?: string };
}

export function lookStyle(look: Look | undefined): string {
  if (!look) return "";
  const lines = [look.underline ? "underline" : "", look.strike ? "line-through" : ""].filter((x) => x).join(" ");
  const b = look.borders ?? {};
  return [
    look.bold ? "font-weight: bold" : "", look.italic ? "font-style: italic" : "", lines ? `text-decoration: ${lines}` : "",
    look.size ? `font-size: ${look.size}px` : "", look.wrap ? "white-space: normal" : "", look.align ? `text-align: ${look.align}` : "",
    ...(["top", "right", "bottom", "left"] as const).map((e) => (b[e] ? `border-${e}: 1px solid ${b[e]}` : "")),
  ].filter((p) => p).join("; ");
}

// A style in any of the dialects, as the grid's AeCS ("" for none).
export function toStyle(style: unknown): string {
  if (style === null || style === undefined || style === "") return "";
  if (typeof style === "string" && style.trim().startsWith("{")) {
    try {
      return toStyle(JSON.parse(style));
    } catch {
      return "";
    }
  }
  const decls: string[] = [];
  if (typeof style === "object") {
    for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
      const name = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const d = declaration(name, String(v));
      if (d) decls.push(d);
    }
  } else {
    for (const part of String(style).split(";")) {
      const word = WORDS[part.trim().toLowerCase()];
      if (word) decls.push(word);
      const i = part.indexOf(":");
      if (i < 0) continue;
      const d = declaration(part.slice(0, i), part.slice(i + 1));
      if (d) decls.push(d);
    }
  }
  return decls.join("; ");
}
