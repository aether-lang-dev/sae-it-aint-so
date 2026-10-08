// sae:scales -- d3-alike scales: a scale is a function from a data value to
// a visual one (a pixel, a colour channel, an angle), with its domain and
// range set by chained calls, inverted, clamped, and asked for the tick
// values an axis should show.
//
//   import { linear, log, band, ticks } from "sae:scales";
//   const x = linear().domain([0, 100]).range([0, 300]);
//   x(50)                                 // 150
//   x.invert(150)                         // 50
//   x.ticks(5)                            // [0, 20, 40, 60, 80, 100]
//   const y = log().domain([1, 1000]).range([200, 0]);
//   const b = band().domain(["a", "b", "c"]).range([0, 300]).padding(0.1);
//   b("b"), b.bandwidth()                 // where a bar starts, how wide
//   const c = ordinal().domain(["a", "b"]).range(["#c44", "#4c4"]);
//
// A setter with no argument is a getter (`x.domain()` reads it); a setter
// returns the scale, so calls chain. Scales are pure: the same input, the
// same output, on every machine.
//
// Idea credit: Cosyne's scales library (Tsyne), itself d3-alike, for which
// scales a page-side library should carry; the code here is sae's own.

export interface Continuous {
  (v: number): number;
  domain(): number[];
  domain(d: number[]): Continuous;
  range(): number[];
  range(r: number[]): Continuous;
  invert(y: number): number;
  clamp(): boolean;
  clamp(on: boolean): Continuous;
  ticks(count?: number): number[];
  nice(count?: number): Continuous;
}

export interface Band {
  (v: string): number;
  domain(): string[];
  domain(d: string[]): Band;
  range(): number[];
  range(r: number[]): Band;
  padding(): number;
  padding(p: number): Band;
  bandwidth(): number;
  step(): number;
}

export interface Ordinal<T> {
  (v: string): T;
  domain(): string[];
  domain(d: string[]): Ordinal<T>;
  range(): T[];
  range(r: T[]): Ordinal<T>;
}

// The step between round tick values for about `count` ticks over
// start .. stop: a power of ten times 1, 2 or 5.
export function tickStep(start: number, stop: number, count: number): number {
  const span = Math.abs(stop - start);
  if (span === 0 || count <= 0) return 0;
  const rough = span / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const error = rough / power;
  const factor = error >= 7.07 ? 10 : error >= 3.16 ? 5 : error >= 1.41 ? 2 : 1;
  return power * factor;
}

// About `count` round values between start and stop, inclusive, in order.
export function ticks(start: number, stop: number, count: number = 10): number[] {
  const step = tickStep(start, stop, count);
  if (step === 0) return [start];
  const lo = Math.min(start, stop), hi = Math.max(start, stop);
  const out: number[] = [];
  const first = Math.ceil(lo / step), last = Math.floor(hi / step);
  for (let i = first; i <= last; i++) out.push(round(i * step, step));
  return start <= stop ? out : out.reverse();
}

// i * step without the floating-point crumbs (0.30000000000000004).
function round(v: number, step: number): number {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(digits));
}

function clampTo(v: number, a: number, b: number): number {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return v < lo ? lo : v > hi ? hi : v;
}

// A continuous scale over a transform of the input (identity for linear,
// a logarithm for log).
function continuous(fwd: (v: number) => number, inv: (v: number) => number, tickFn: (d: number[], n: number) => number[], niceFn: (d: number[], n: number) => number[]): Continuous {
  let dom = [0, 1], rng = [0, 1], clamped = false;
  const scale = ((v: number): number => {
    const d0 = fwd(dom[0]), d1 = fwd(dom[1]);
    let t = d1 === d0 ? 0.5 : (fwd(v) - d0) / (d1 - d0);
    if (clamped) t = clampTo(t, 0, 1);
    return rng[0] + (rng[1] - rng[0]) * t;
  }) as Continuous;
  scale.domain = ((d?: number[]) => {
    if (d === undefined) return dom.slice();
    dom = [d[0], d[1]];
    return scale;
  }) as Continuous["domain"];
  scale.range = ((r?: number[]) => {
    if (r === undefined) return rng.slice();
    rng = [r[0], r[1]];
    return scale;
  }) as Continuous["range"];
  scale.clamp = ((on?: boolean) => {
    if (on === undefined) return clamped;
    clamped = on;
    return scale;
  }) as Continuous["clamp"];
  scale.invert = (y: number): number => {
    const d0 = fwd(dom[0]), d1 = fwd(dom[1]);
    let t = rng[1] === rng[0] ? 0.5 : (y - rng[0]) / (rng[1] - rng[0]);
    if (clamped) t = clampTo(t, 0, 1);
    // 15 significant digits: so log().invert(2) is 100, not 99.9999999999999
    return inv(Number((d0 + (d1 - d0) * t).toPrecision(15)));
  };
  scale.ticks = (count: number = 10): number[] => tickFn(dom, count);
  scale.nice = (count: number = 10): Continuous => {
    dom = niceFn(dom, count);
    return scale;
  };
  return scale;
}

// y = a * x + b.
export function linear(domain?: number[], range?: number[]): Continuous {
  const s = continuous(
    (v) => v,
    (v) => v,
    (d, n) => ticks(d[0], d[1], n),
    (d, n) => {
      const step = tickStep(d[0], d[1], n);
      if (step === 0) return d.slice();
      const lo = Math.floor(Math.min(d[0], d[1]) / step) * step;
      const hi = Math.ceil(Math.max(d[0], d[1]) / step) * step;
      return d[0] <= d[1] ? [round(lo, step), round(hi, step)] : [round(hi, step), round(lo, step)];
    });
  if (domain) s.domain(domain);
  if (range) s.range(range);
  return s;
}

// y = a * log(x) + b, for a domain that does not cross zero. Ticks are the
// powers of the base inside the domain, with 2 .. 9 multiples of each when
// the domain spans three decades or fewer.
export function log(domain?: number[], range?: number[], base: number = 10): Continuous {
  const lg = (v: number) => Math.log(Math.abs(v)) / Math.log(base);
  const s = continuous(
    (v) => lg(v),
    (v) => base ** v,
    (d) => {
      const lo = Math.min(d[0], d[1]), hi = Math.max(d[0], d[1]);
      if (lo <= 0) throw new Error("sae:scales log: the domain must not reach 0");
      const out: number[] = [];
      const p0 = Math.floor(lg(lo) + 1e-9), p1 = Math.ceil(lg(hi) - 1e-9);
      const fine = p1 - p0 <= 3 && base === 10;
      for (let p = p0; p <= p1; p++) {
        const decade = base ** p;
        for (let k = 1; k < (fine ? base : 2); k++) {
          const v = round(decade * k, decade);
          if (v >= lo - 1e-9 && v <= hi + 1e-9) out.push(v);
        }
      }
      return d[0] <= d[1] ? out : out.reverse();
    },
    (d) => {
      const lo = base ** Math.floor(lg(Math.min(d[0], d[1])) + 1e-9);
      const hi = base ** Math.ceil(lg(Math.max(d[0], d[1])) - 1e-9);
      return d[0] <= d[1] ? [lo, hi] : [hi, lo];
    });
  if (domain) s.domain(domain);
  if (range) s.range(range);
  return s;
}

// Discrete values to evenly spaced bands of one width across the range,
// with a fraction of each step left as padding, between the bands and at
// both ends (d3's band scale with inner and outer padding equal): bar
// charts.
export function band(domain?: string[], range?: number[]): Band {
  let dom: string[] = [], rng = [0, 1], pad = 0;
  const step = (): number => {
    const n = dom.length;
    if (n === 0) return 0;
    return (rng[1] - rng[0]) / Math.max(1, n + pad);
  };
  const scale = ((v: string): number => {
    const i = dom.indexOf(v);
    if (i < 0) return NaN;
    const st = step();
    return rng[0] + st * (i + pad);
  }) as Band;
  scale.domain = ((d?: string[]) => {
    if (d === undefined) return dom.slice();
    dom = d.slice();
    return scale;
  }) as Band["domain"];
  scale.range = ((r?: number[]) => {
    if (r === undefined) return rng.slice();
    rng = [r[0], r[1]];
    return scale;
  }) as Band["range"];
  scale.padding = ((p?: number) => {
    if (p === undefined) return pad;
    pad = clampTo(p, 0, 1);
    return scale;
  }) as Band["padding"];
  scale.step = step;
  scale.bandwidth = (): number => step() * (1 - pad);
  if (domain) scale.domain(domain);
  if (range) scale.range(range);
  return scale;
}

// Discrete values to discrete values (names to colours, say), cycling
// through the range when the domain is longer; a value not in the domain is
// added to its end, as d3 does.
export function ordinal<T>(domain?: string[], range?: T[]): Ordinal<T> {
  let dom: string[] = [], rng: T[] = [];
  const scale = ((v: string): T => {
    let i = dom.indexOf(v);
    if (i < 0) {
      dom.push(v);
      i = dom.length - 1;
    }
    return rng[i % rng.length];
  }) as Ordinal<T>;
  scale.domain = ((d?: string[]) => {
    if (d === undefined) return dom.slice();
    dom = d.slice();
    return scale;
  }) as Ordinal<T>["domain"];
  scale.range = ((r?: T[]) => {
    if (r === undefined) return rng.slice();
    rng = r.slice();
    return scale;
  }) as Ordinal<T>["range"];
  if (domain) scale.domain(domain);
  if (range) scale.range(range);
  return scale;
}
