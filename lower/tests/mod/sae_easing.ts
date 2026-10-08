// sae:easing: every curve starts at 0 and ends at 1, the standard ones are
// monotonic, lerp/tween, and lookup by name.
import * as e from "sae:easing";
import { easeOutCubic, lerp, tween, ease, names } from "sae:easing";
const f = (v: number) => v.toFixed(4);
print("count:", names.length);
let ends = true, mono = true;
for (const name of names) {
  const fn = ease(name);
  if (f(fn(0)) !== "0.0000" || f(fn(1)) !== "1.0000") { ends = false; print("ends:", name, fn(0), fn(1)); }
  if (!/back|elastic|bounce/.test(name)) {   // these go up and down by design
    for (let i = 1; i <= 20; i++) if (fn(i / 20) < fn((i - 1) / 20) - 1e-12) { mono = false; print("not monotonic:", name, i); }
  }
}
print("ends at 0 and 1:", ends, "monotonic:", mono);
print("quad:", f(e.easeInQuad(0.5)), f(e.easeOutQuad(0.5)), f(e.easeInOutQuad(0.25)), f(e.easeInOutQuad(0.75)));
print("cubic:", f(e.easeInCubic(0.5)), f(easeOutCubic(0.5)), f(e.easeInOutCubic(0.5)));
print("sine/expo/circ:", f(e.easeInSine(0.5)), f(e.easeOutExpo(0.5)), f(e.easeInCirc(0.5)));
print("overshoot:", e.easeOutBack(0.5) > 1, e.easeInBack(0.5) < 0, e.easeOutElastic(0.2) > 1);
print("bounce:", f(e.easeOutBounce(0.5)), f(e.easeInBounce(0.5)));
print("lerp/tween:", lerp(10, 20, 0.25), tween(10, 20, 0.5, e.easeInQuad), tween(10, 20, 2), tween(0, 8, -1));
print("by name:", ease("easeOutCubic") === easeOutCubic, ease("out-cubic") === easeOutCubic, ease("OutCubic") === easeOutCubic, ease("linear")(0.3));
try { ease("wobble"); } catch (err: any) { print("unknown:", err.message); }
// expect: count: 31
// expect: ends at 0 and 1: true monotonic: true
// expect: quad: 0.2500 0.7500 0.1250 0.8750
// expect: cubic: 0.1250 0.8750 0.5000
// expect: sine/expo/circ: 0.2929 0.9688 0.1340
// expect: overshoot: true true true
// expect: bounce: 0.7656 0.2344
// expect: lerp/tween: 12.5 12.5 20 0
// expect: by name: true true true 0.3
// expect: unknown: sae:easing has no curve called "wobble"
