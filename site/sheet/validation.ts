// Data validation: a cell's rule for what may be typed into it, as Excel's
// Data Validation and the Tauri spreadsheet's rules have it. A list of
// values (any case), whole numbers or decimals within limits, or a text
// length; "stop" refuses what breaks it, "warn" keeps it and says so; and,
// from the Tauri app, "create" checks only what is typed into an empty cell,
// "update" only what replaces something. An empty input, and a formula, are
// not checked (Excel checks what is typed, not what a formula comes to).
export interface Rule {
  readonly kind: "list" | "whole" | "decimal" | "length";
  readonly values?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly mode: "stop" | "warn";
  readonly when: "always" | "create" | "update";
}

const number = (s: string | undefined, what: string): number | undefined => {
  if (s === undefined || s.trim() === "") return undefined;
  const n = Number(s);
  if (isNaN(n)) throw new RangeError(`${what} ${s} is not a number`);
  return n;
};

// A rule from a command's parameters (kind, values, min, max, mode, when).
export function ruleOf(p: Readonly<Record<string, string | undefined>>): Rule {
  const kind = String(p.kind ?? "").toLowerCase();
  if (!["list", "whole", "decimal", "length"].includes(kind)) throw new RangeError(`${p.kind} is not a rule (list, whole, decimal, length)`);
  const mode = String(p.mode ?? "stop").toLowerCase(), when = String(p.when ?? "always").toLowerCase();
  if (mode !== "stop" && mode !== "warn") throw new RangeError(`${p.mode} is not stop or warn`);
  if (!["always", "create", "update"].includes(when)) throw new RangeError(`${p.when} is not always, create or update`);
  if (kind === "list") {
    const values = String(p.values ?? "").split(",").map((v) => v.trim()).filter((v) => v);
    if (!values.length) throw new RangeError("a list rule needs values");
    return { kind, values, mode, when } as Rule;
  }
  return { kind, min: number(p.min, "min"), max: number(p.max, "max"), mode, when } as Rule;
}

const limits = (r: Rule): string =>
  r.min !== undefined && r.max !== undefined ? `from ${r.min} to ${r.max}` : r.min !== undefined ? `of at least ${r.min}` : r.max !== undefined ? `of at most ${r.max}` : "";

// What the rule asks, as "must be ...".
export function describeRule(r: Rule): string {
  switch (r.kind) {
    case "list": return `must be one of ${r.values!.join(", ")}`;
    case "whole": return `must be a whole number ${limits(r)}`.trim();
    case "decimal": return `must be a number ${limits(r)}`.trim();
    case "length":
      return r.min !== undefined && r.max !== undefined ? `must be ${r.min} to ${r.max} characters long`
        : r.max !== undefined ? `must be at most ${r.max} characters long` : `must be at least ${r.min ?? 0} characters long`;
  }
}

const within = (n: number, r: Rule) => (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max);

// Null when `input` keeps the rule (or the rule does not apply: an empty
// input, a formula, or not when it checks), else why not. `wasEmpty`: the
// cell held nothing before.
export function check(r: Rule, input: string, wasEmpty: boolean): string | null {
  const t = input.trim();
  if (t === "" || t.startsWith("=")) return null;
  if ((r.when === "create" && !wasEmpty) || (r.when === "update" && wasEmpty)) return null;
  let ok: boolean;
  switch (r.kind) {
    case "list": ok = r.values!.some((v) => v.toLowerCase() === t.toLowerCase()); break;
    case "whole": ok = /^[-+]?\d+$/.test(t) && within(Number(t), r); break;
    case "decimal": ok = !isNaN(Number(t)) && within(Number(t), r); break;
    case "length": ok = within(t.length, r); break;
  }
  return ok ? null : describeRule(r);
}

// Limits as a person types them: "1..10", "1 to 10", "1-10", ">=0",
// "<= 5", or one number (at least it).
export function limitsOf(text: string): { min?: string; max?: string } {
  const t = text.trim(), n = "(-?\\d+(?:\\.\\d+)?)";
  let m = new RegExp(`^${n}\\s*(?:\\.\\.|to|-)\\s*${n}$`, "i").exec(t);
  if (m) return { min: m[1], max: m[2] };
  m = new RegExp(`^(>=?|<=?)\\s*${n}$`).exec(t);
  if (m) return m[1].startsWith(">") ? { min: m[2] } : { max: m[2] };
  return new RegExp(`^${n}$`).test(t) ? { min: t } : {};
}
