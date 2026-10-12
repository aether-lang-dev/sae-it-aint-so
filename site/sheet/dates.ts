// Dates on Excel's serial numbers: days since 1899-12-30 (so 1 is
// 1899-12-31, which Excel calls 1900-01-01; the two agree from 1900-03-01
// on, Excel counting a 29 February 1900 that never was), a time the
// fraction of a day. Pure date arithmetic, for the library's date functions
// and numfmt.ts.
const EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;

export const serial = (y: number, m: number, d: number): number => (Date.UTC(y, m - 1, d) - EPOCH) / DAY;

// A serial's year, month (1-12), day and weekday (0 Sunday).
export function parts(s: number): { y: number; m: number; d: number; weekday: number } {
  const t = new Date(EPOCH + Math.floor(s) * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), weekday: t.getUTCDay() };
}

// Text as a date: 2024-01-15, or month first, 1/15/2024; null if not one.
export function parseDate(text: string): number | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return serial(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) return serial(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[1]), Number(m[2]));
  return null;
}

// Months on, the day kept (or the month's last, when it has fewer).
export function addMonths(s: number, months: number): number {
  const { y, m, d } = parts(s);
  const last = parts(serial(y, m + months + 1, 0)).d;
  return serial(y, m + months, Math.min(d, last));
}

export const endOfMonth = (s: number, months: number): number => {
  const { y, m } = parts(s);
  return serial(y, m + months + 1, 0);
};

const weekend = (s: number) => [0, 6].includes(parts(s).weekday);

// Weekdays from start to end, both counted, holidays not (either order: negative).
export function workdaysBetween(start: number, end: number, holidays: ReadonlySet<number>): number {
  const [a, b] = start <= end ? [start, end] : [end, start];
  let n = 0;
  for (let s = Math.floor(a); s <= Math.floor(b); s++) if (!weekend(s) && !holidays.has(s)) n++;
  return start <= end ? n : -n;
}

// The workday `days` workdays from start (back, when negative).
export function workdayFrom(start: number, days: number, holidays: ReadonlySet<number>): number {
  let s = Math.floor(start);
  const step = Math.sign(days);
  for (let left = Math.abs(days); left > 0;) {
    s += step;
    if (!weekend(s) && !holidays.has(s)) left--;
  }
  return s;
}

// DATEDIF's units: whole years, months or days between, or the months
// past the years (YM), the days past the months (MD), the days past the
// years (YD).
export function dateDif(start: number, end: number, unit: string): number | null {
  const a = parts(start), b = parts(end);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months--;
  switch (unit.toUpperCase()) {
    case "Y": return Math.floor(months / 12);
    case "M": return months;
    case "D": return Math.floor(end) - Math.floor(start);
    case "YM": return months % 12;
    case "MD": return b.d >= a.d ? b.d - a.d : Math.floor(end) - serial(b.y, b.m - 1, a.d);
    case "YD": {
      const from = serial(b.m > a.m || (b.m === a.m && b.d >= a.d) ? b.y : b.y - 1, a.m, a.d);
      return Math.floor(end) - from;
    }
    default: return null;
  }
}

// Now as a serial, in the page's local time (the coarse clock in the browser).
export const now = (): number => {
  const t = new Date();
  return (t.getTime() - t.getTimezoneOffset() * 60_000 - EPOCH) / DAY;
};
