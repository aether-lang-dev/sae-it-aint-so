// Number formats and cell styles, in the dialects the Tauri spreadsheet's
// files use: its own format strings ("bold;color:red;align:center;
// number:0.00", "currency:USD", "percent:0.0%"), Excel-style patterns
// ("$#,##0.00", "0.00%"), CSS objects ({ fontWeight: "bold" }) and the JSON
// of one (what a RexxJS style function gives). A style comes out as the AeCS
// a ui.datagrid cell draws: background, color (hex), font-weight: bold and
// text-align; what the grid cannot draw (italic, sizes, underline) is left out.
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

// An Excel-style pattern: text before the digits is a prefix, after them a
// suffix; % multiplies by a hundred; a comma groups thousands.
function excelPattern(n: number, pattern: string): string | null {
  const m = /^([^#0]*)([#0,]*(?:\.0+)?)(%?)(.*)$/.exec(pattern);
  if (!m || !m[2]) return null;
  const percent = m[3] === "%";
  return written(percent ? n * 100 : n, placesIn(m[2]), m[2].includes(","), m[1], m[3] + m[4]);
}

function numberPart(n: number, part: string): string | null {
  const [kind, arg = ""] = part.split(/:(.*)/s);
  switch (kind.trim()) {
    case "number": return written(n, placesIn(arg), arg.includes(","));
    case "currency": {
      const code = arg.trim().toUpperCase() || "USD";
      return written(n, 2, true, CURRENCIES[code] ?? `${code} `);
    }
    case "percent": return written(n * 100, placesIn(arg), false, "", "%");
    default: return /^[^:]*[#0]/.test(part) ? excelPattern(n, part.trim()) : null;
  }
}

// A value as its format writes it, or null when the format does not apply
// (no number format in it, or the value is not a number).
export function formatted(v: Value, format: string): string | null {
  if (!format) return null;
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
    default:
      return null;
  }
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
      if (part.trim() === "bold") decls.push("font-weight: bold");
      const i = part.indexOf(":");
      if (i < 0) continue;
      const d = declaration(part.slice(0, i), part.slice(i + 1));
      if (d) decls.push(d);
    }
  }
  return decls.join("; ");
}
