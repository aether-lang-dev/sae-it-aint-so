// sae:noise and sae:easing from the page standard library: no capability,
// deterministic values.
import { noise, perlin2 } from "sae:noise";
import { easeOutCubic, tween } from "sae:easing";
const n = noise(7);
const f = (v: number) => v.toFixed(4);
ui.text(`noise: ${f(n.value1(0.5))} ${f(n.perlin2(1.3, 2.7))} ${f(perlin2(1.3, 2.7, 7))} ${f(n.fbm2(0.3, 0.6))}`);
ui.text(`easing: ${easeOutCubic(0.5)} ${tween(0, 10, 0.5, easeOutCubic)}`);
ui.btn("Imports page", () => browserContext.changePage("/imports"));
