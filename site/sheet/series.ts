// Fill Series: what follows the first cells of a column (or row), as a
// spreadsheet continues them. Numbers go on by 1, or by the step between the
// first two; dates (YYYY-MM-DD) by a day, or by their step; text ending in a
// number ("Item 1", "Q-07") by its number; days, months and quarters round
// and round, in the case they were given. Anything else is copied (a formula
// too: the command moves it by its offset, as Fill Down does).

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const NUMBER = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)\s*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TRAILING = /^(.*?)(\d+)$/;

// A name in one of the cycles: its cycle, where, and how it was written
// (short or long, and its case).
function cycleOf(s: string): { names: string[]; at: number; short: boolean; caseOf: (x: string) => string } | null {
  const t = s.trim();
  for (const names of [DAYS, MONTHS, QUARTERS]) {
    const short = names !== QUARTERS && t.length === 3;
    const at = names.findIndex((n) => (short ? n.slice(0, 3) : n).toLowerCase() === t.toLowerCase());
    if (at < 0) continue;
    const caseOf = t === t.toUpperCase() && t !== t.toLowerCase() && t.length > 1 && names !== QUARTERS ? (x: string) => x.toUpperCase()
      : t === t.toLowerCase() ? (x: string) => x.toLowerCase() : (x: string) => x;
    return { names, at, short, caseOf };
  }
  return null;
}

const day = 86_400_000;
const dateOf = (s: string): number | null => {
  const m = DATE.exec(s.trim());
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const isoDate = (t: number) => new Date(t).toISOString().slice(0, 10);

// The `n` cells after `first` (one or two cells: two give the step).
export function continued(first: readonly string[], n: number): string[] {
  const [a, b] = first;
  const out: string[] = [];
  const two = b !== undefined;
  if (a.startsWith("=")) return Array.from({ length: n }, (_, i) => first[i % first.length]);
  if (NUMBER.test(a) && (!two || NUMBER.test(b))) {
    const x = Number(a), step = two ? Number(b) - x : 1, last = two ? Number(b) : x;
    for (let i = 1; i <= n; i++) out.push(String(Number((last + step * i).toPrecision(12))));
    return out;
  }
  const da = dateOf(a), db = two ? dateOf(b) : null;
  if (da !== null && (!two || db !== null)) {
    const step = two ? db! - da : day, last = two ? db! : da;
    for (let i = 1; i <= n; i++) out.push(isoDate(last + step * i));
    return out;
  }
  const ca = cycleOf(a), cb = two ? cycleOf(b) : null;
  if (ca && (!two || (cb && cb.names === ca.names))) {
    const len = ca.names.length, step = two ? (cb!.at - ca.at + len) % len : 1, last = two ? cb!.at : ca.at;
    for (let i = 1; i <= n; i++) {
      const name = ca.names[(last + step * i) % len];
      out.push(ca.caseOf(ca.short ? name.slice(0, 3) : name));
    }
    return out;
  }
  const ta = TRAILING.exec(a), tb = two ? TRAILING.exec(b) : null;
  if (ta && (!two || (tb && tb[1] === ta[1]))) {
    const width = ta[2].length, x = Number(ta[2]), step = two ? Number(tb![2]) - x : 1, last = two ? Number(tb![2]) : x;
    for (let i = 1; i <= n; i++) out.push(ta[1] + String(last + step * i).padStart(width, "0"));
    return out;
  }
  for (let i = 0; i < n; i++) out.push(first[i % first.length]);
  return out;
}
