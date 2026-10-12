// Money over time, as Excel's financial functions work it out: a rate per
// period, a number of periods, a payment each period (at its end, type 0,
// or its start, type 1), a present and a future value, money paid out
// negative. Pure arithmetic for the library.

const grow = (rate: number, n: number) => (1 + rate) ** n;

export function pmt(rate: number, n: number, pv: number, fv = 0, type = 0): number {
  if (rate === 0) return -(pv + fv) / n;
  const g = grow(rate, n);
  return -(rate * (fv + pv * g)) / ((1 + rate * type) * (g - 1));
}

export function fv(rate: number, n: number, payment: number, pv = 0, type = 0): number {
  if (rate === 0) return -(pv + payment * n);
  const g = grow(rate, n);
  return -(pv * g + (payment * (1 + rate * type) * (g - 1)) / rate);
}

export function pv(rate: number, n: number, payment: number, fv = 0, type = 0): number {
  if (rate === 0) return -(fv + payment * n);
  const g = grow(rate, n);
  return -(fv + (payment * (1 + rate * type) * (g - 1)) / rate) / g;
}

export function nper(rate: number, payment: number, pv: number, fv = 0, type = 0): number {
  if (rate === 0) return -(pv + fv) / payment;
  const p = payment * (1 + rate * type);
  return Math.log((p - fv * rate) / (p + pv * rate)) / Math.log(1 + rate);
}

// Newton's method from a guess; null if it does not settle.
function solve(f: (x: number) => number, guess: number): number | null {
  let x = guess;
  for (let i = 0; i < 100; i++) {
    const y = f(x), h = 1e-7 * Math.max(1, Math.abs(x)), slope = (f(x + h) - y) / h;
    if (!Number.isFinite(slope) || slope === 0) return null;
    const next = x - y / slope;
    if (Math.abs(next - x) < 1e-12) return next;
    x = next;
  }
  return null;
}

// The rate per period that makes the payments pay pv off to fv.
export const rate = (n: number, payment: number, pv: number, fv = 0, type = 0, guess = 0.1): number | null =>
  solve((r) => (r === 0 ? pv + payment * n + fv : pv * grow(r, n) + (payment * (1 + r * type) * (grow(r, n) - 1)) / r + fv), guess);

// Cash flows at the ends of periods 1, 2 ... discounted to now.
export const npv = (rate: number, flows: readonly number[]): number => flows.reduce((s, c, i) => s + c / grow(rate, i + 1), 0);

// The rate at which flows from now (period 0) on are worth nothing now.
export const irr = (flows: readonly number[], guess = 0.1): number | null =>
  solve((r) => flows.reduce((s, c, i) => s + c / grow(r, i), 0), guess);
