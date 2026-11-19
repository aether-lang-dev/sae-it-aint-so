// examples/charts, headless: the bar, heat and colour formulas of Tsyne's
// bar-chart and heatmap-demo (Paul Hammant, MIT), and the line interpolations.
import { barValue, barMax, heatValue, viridis, rgbCss, linePath, DATA1, zoomed, panned } from "./examples/charts/lib/charts.ts";
import { eq } from "./lib/check.ts";

const q = (v: number) => Math.round(v * 1000) / 1000;
eq("bars at t=0: 50, then each 20 higher plus its phase's sine", [0, 1, 2, 3, 4, 5].map((i) => q(barValue(i, 0))), [50, 104.641, 124.641, 110, 95.359, 115.359]);
eq("a bar a quarter period on: bar 0, frequency 0.5, peaks at t = pi", q(barValue(0, Math.PI)), q(50 + Math.sin(Math.PI * 0.5) * 40));
eq("the axis is at least 100 and follows the tallest bar", [barMax([10, 20]), barMax([50, 134.6])], [100, 134.6]);
eq("a shift moves every phase", q(barValue(0, 0, Math.PI / 2)), 90);
eq("heat at t=0: row 0 col 0 is 50, row 0 col 5 is 50 + 40 sin(0.5)", [q(heatValue(0, 0, 0)), q(heatValue(0, 5, 0))], [50, q(50 + 40 * Math.sin(0.5))]);
let lo = 100, hi = 0;
for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (let t = 0; t < 20; t += 0.7) { const v = heatValue(r, c, t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
eq("heat stays within 10 and 90 (50 +- 40) and so inside 0 to 100", [lo >= 10 - 1e-9, hi <= 90 + 1e-9], [true, true]);
eq("the ramp: purple at 0, dark green near a third, yellow green at two thirds, orange at 100", [0, 33, 67, 100].map((v) => rgbCss(viridis(v))), ["rgb(68, 1, 84)", "rgb(99, 111, 0)", "rgb(186, 216, 0)", "rgb(255, 122, 45)"]);
const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }];
eq("linear", linePath(pts, "linear"), "M0 0 L10 10 L20 0");
eq("step turns at the middles", linePath(pts, "step"), "M0 0 L5 0 L5 10 L15 10 L15 0 L20 0");
eq("catmull-rom is cubic through every point", [linePath(pts, "catmull-rom").split("C").length - 1, linePath(pts, "catmull-rom").endsWith("20 0")], [2, true]);
eq("monotone is cubic too, and level at a peak", linePath(pts, "monotone"), "M0 0 C3.333 3.333 6.667 10 10 10 C13.333 10 16.667 3.333 20 0");
const m = linePath(DATA1.map((p) => ({ x: p.x, y: 100 - p.y })), "monotone");
const ys = [...m.matchAll(/C[\d.\-]+ ([\d.\-]+) [\d.\-]+ ([\d.\-]+)/g)].flatMap((x) => [Number(x[1]), Number(x[2])]);
eq("monotone control points never leave the data's range (no overshoot)", [Math.min(...ys) >= 100 - 80 - 1e-6, Math.max(...ys) <= 100 - 35 + 1e-6], [true, true]);
eq("an empty series is an empty path", linePath([], "linear"), "");
eq("zoom steps are 15%, held between 0.5 and 5", [q(zoomed({ scale: 1, tx: 0, ty: 0 }, 1).scale), zoomed({ scale: 1, tx: 0, ty: 0 }, -99).scale, zoomed({ scale: 1, tx: 0, ty: 0 }, 99).scale], [1.15, 0.5, 5]);
eq("a pan adds", panned({ scale: 2, tx: 1, ty: 2 }, 3, 4), { scale: 2, tx: 4, ty: 6 });
// expect: ok bars at t=0: 50, then each 20 higher plus its phase's sine
// expect: ok a bar a quarter period on: bar 0, frequency 0.5, peaks at t = pi
// expect: ok the axis is at least 100 and follows the tallest bar
// expect: ok a shift moves every phase
// expect: ok heat at t=0: row 0 col 0 is 50, row 0 col 5 is 50 + 40 sin(0.5)
// expect: ok heat stays within 10 and 90 (50 +- 40) and so inside 0 to 100
// expect: ok the ramp: purple at 0, dark green near a third, yellow green at two thirds, orange at 100
// expect: ok linear
// expect: ok step turns at the middles
// expect: ok catmull-rom is cubic through every point
// expect: ok monotone is cubic too, and level at a peak
// expect: ok monotone control points never leave the data's range (no overshoot)
// expect: ok an empty series is an empty path
// expect: ok zoom steps are 15%, held between 0.5 and 5
// expect: ok a pan adds
