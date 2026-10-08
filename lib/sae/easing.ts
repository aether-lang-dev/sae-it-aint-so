// sae:easing -- the standard easing curves (Penner's family, as every
// animation library names them), each a function from progress t in 0 .. 1
// to eased progress, plus lerp, clamp and a by-name lookup.
//
//   import { easeOutCubic, lerp, ease } from "sae:easing";
//   const x = lerp(x0, x1, easeOutCubic(t));
//   const f = ease("inOutQuad");          // by name, with or without "ease"
//
// `in` curves start slowly, `out` curves end slowly, `inOut` both. The back
// and elastic curves overshoot (they leave 0 .. 1 on purpose); bounce lands
// like a ball. Every function is pure.
//
// Idea credit: Cosyne's easing library (Tsyne) for which curves a page-side
// library should carry; the code here is sae's own.

export type Easing = (t: number) => number;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export const linear: Easing = (t) => t;

export const easeInQuad: Easing = (t) => t * t;
export const easeOutQuad: Easing = (t) => t * (2 - t);
export const easeInOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export const easeInCubic: Easing = (t) => t * t * t;
export const easeOutCubic: Easing = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - 4 * (1 - t) * (1 - t) * (1 - t));

export const easeInQuart: Easing = (t) => t * t * t * t;
export const easeOutQuart: Easing = (t) => 1 - (1 - t) ** 4;
export const easeInOutQuart: Easing = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - 8 * (1 - t) ** 4);

export const easeInQuint: Easing = (t) => t ** 5;
export const easeOutQuint: Easing = (t) => 1 - (1 - t) ** 5;
export const easeInOutQuint: Easing = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - 16 * (1 - t) ** 5);

export const easeInSine: Easing = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const easeOutSine: Easing = (t) => Math.sin((t * Math.PI) / 2);
export const easeInOutSine: Easing = (t) => (1 - Math.cos(t * Math.PI)) / 2;

export const easeInExpo: Easing = (t) => (t <= 0 ? 0 : 2 ** (10 * (t - 1)));
export const easeOutExpo: Easing = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeInOutExpo: Easing = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 11) : 1 - 2 ** (9 - 20 * t);

export const easeInCirc: Easing = (t) => 1 - Math.sqrt(1 - t * t);
export const easeOutCirc: Easing = (t) => Math.sqrt(1 - (1 - t) * (1 - t));
export const easeInOutCirc: Easing = (t) =>
  t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - 4 * (1 - t) * (1 - t)) + 1) / 2;

const BACK = 1.70158;
export const easeInBack: Easing = (t) => t * t * ((BACK + 1) * t - BACK);
export const easeOutBack: Easing = (t) => 1 + (t - 1) * (t - 1) * ((BACK + 1) * (t - 1) + BACK);
export const easeInOutBack: Easing = (t) => {
  const s = BACK * 1.525;
  return t < 0.5
    ? (4 * t * t * ((s + 1) * 2 * t - s)) / 2
    : (4 * (t - 1) * (t - 1) * ((s + 1) * (2 * t - 2) + s) + 2) / 2;
};

export const easeInElastic: Easing = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin(((t * 10 - 10.75) * 2 * Math.PI) / 3);
export const easeOutElastic: Easing = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
export const easeInOutElastic: Easing = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1
    : t < 0.5
      ? -(2 ** (20 * t - 10) * Math.sin(((20 * t - 11.125) * 2 * Math.PI) / 4.5)) / 2
      : (2 ** (-20 * t + 10) * Math.sin(((20 * t - 11.125) * 2 * Math.PI) / 4.5)) / 2 + 1;

export const easeOutBounce: Easing = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
  if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
  t -= 2.625 / d;
  return n * t * t + 0.984375;
};
export const easeInBounce: Easing = (t) => 1 - easeOutBounce(1 - t);
export const easeInOutBounce: Easing = (t) =>
  t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2;

const BY_NAME: Record<string, Easing> = {
  linear,
  inquad: easeInQuad, outquad: easeOutQuad, inoutquad: easeInOutQuad,
  incubic: easeInCubic, outcubic: easeOutCubic, inoutcubic: easeInOutCubic,
  inquart: easeInQuart, outquart: easeOutQuart, inoutquart: easeInOutQuart,
  inquint: easeInQuint, outquint: easeOutQuint, inoutquint: easeInOutQuint,
  insine: easeInSine, outsine: easeOutSine, inoutsine: easeInOutSine,
  inexpo: easeInExpo, outexpo: easeOutExpo, inoutexpo: easeInOutExpo,
  incirc: easeInCirc, outcirc: easeOutCirc, inoutcirc: easeInOutCirc,
  inback: easeInBack, outback: easeOutBack, inoutback: easeInOutBack,
  inelastic: easeInElastic, outelastic: easeOutElastic, inoutelastic: easeInOutElastic,
  inbounce: easeInBounce, outbounce: easeOutBounce, inoutbounce: easeInOutBounce,
};

// The curve called `name`: "easeOutCubic", "outCubic", "out-cubic" or
// "OutCubic" all name the same one. Throws for a name that is not one.
export function ease(name: string): Easing {
  const key = name.toLowerCase().replace(/^ease/, "").replace(/[-_ ]/g, "");
  const f = BY_NAME[key];
  if (!f) throw new Error(`sae:easing has no curve called "${name}"`);
  return f;
}

export const names: string[] = Object.keys(BY_NAME);

// `from` to `to` at eased progress t (t is clamped to 0 .. 1 first).
export function tween(from: number, to: number, t: number, curve: Easing = linear): number {
  return lerp(from, to, curve(clamp01(t)));
}
