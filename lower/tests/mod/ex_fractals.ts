// examples/fractals, headless: the algorithm cases of Tsyne's mandelbrot,
// julia-set (and the other three) tests (Paul Hammant, BSD-3-Clause), and the
// view arithmetic every explorer shared.
import { mandelbrot, julia, newton, tricorn, burningShip, palettes, paletteNames } from "./examples/fractals/lib/fractal-utils.ts";
import { KINDS, PRESETS, pointAt, tapZoom, scrollZoom, zoomIn, zoomOut, pan, scaleOf } from "./examples/fractals/lib/views.ts";
import { eq } from "./lib/check.ts";

eq("the origin is in the Mandelbrot set", mandelbrot(0, 0, 100), 100);
eq("a point far out escapes at once", mandelbrot(10, 10, 100) < 5, true);
const edge = mandelbrot(-0.75, 0.1, 100);
eq("a point near the edge takes a few iterations", [edge > 1, edge < 100], [true, true]);
eq("Julia, classic c: the origin escapes", julia(0, 0, 100, -0.4, 0.6) < 100, true);
eq("Julia: far out escapes at once", julia(10, 10, 100, -0.4, 0.6) < 5, true);
eq("Julia, dendrite c=(0,1): the origin stays", julia(0, 0, 100, 0, 1), 100);
eq("the origin is not in the Tricorn's escape region either", tricorn(0, 0, 100), 100);
eq("the Tricorn is symmetric about the real axis: c and its conjugate agree", tricorn(-0.5, 0.3, 100) === tricorn(-0.5, -0.3, 100), true);
eq("Burning Ship: far out escapes at once, the origin stays", [burningShip(10, 10, 100) < 5, burningShip(0, 0, 100)], [true, 100]);
eq("Newton for z^3 = 1: a root converges at once, far out takes a few more steps", [newton(1, 0, 64), newton(1.2, 0.1, 64) < 10], [0, true]);
eq("eight palettes, classic first", [paletteNames.length, paletteNames[0]], [8, "classic"]);
eq("every palette paints the inside black", paletteNames.map((n) => palettes[n](100, 100).join(",")), paletteNames.map(() => "0,0,0,255"));
eq("grayscale", [palettes.grayscale(0, 256), palettes.grayscale(128, 256)], [[0, 0, 0, 255], [127, 127, 127, 255]]);
eq("five explorers and six Julia presets", [KINDS.map((k) => k.name), PRESETS.length], [["Mandelbrot", "Julia set", "Newton fractal", "Tricorn", "Burning Ship"], 6]);
eq("each kind's start view", KINDS.map((k) => [k.centerX, k.centerY, k.zoom, k.maxIter]), [[-0.5, 0, 1, 256], [0, 0, 1.5, 256], [0, 0, 2, 64], [-0.3, 0, 1, 256], [-0.4, -0.6, 0.8, 256]]);
const v = { centerX: -0.5, centerY: 0, zoom: 1 };
eq("zoom 1 spans 3 units across 200 pixels", scaleOf(v, 200, 200), 0.015);
eq("the middle pixel is the centre", pointAt(v, 200, 200, 100, 100), [-0.5, 0]);
const q = (p: [number, number]) => p.map((x) => Math.round(x * 1e6) / 1e6);
eq("pixel (190, 100) is 0.85 on the real axis", q(pointAt(v, 200, 200, 190, 100)), [0.85, 0]);
const t = tapZoom(v, 200, 200, 190, 100);
eq("a tap centres on the point and doubles the zoom", [Math.round(t.centerX * 1e6) / 1e6, t.centerY, t.zoom], [0.85, 0, 2]);
eq("zoom in and out, out stopping at 0.5", [zoomIn(v).zoom, zoomOut(zoomOut(zoomOut(v))).zoom], [2, 0.5]);
const pn = pan(v, 200, 200, 1, 0);
eq("a pan is 50 pixels", Math.round((pn.centerX - v.centerX) * 1e6) / 1e6, 0.75);
const sc = scrollZoom(v, 200, 200, 150, 60, 1);
const before = pointAt(v, 200, 200, 150, 60), after = pointAt(sc, 200, 200, 150, 60);
eq("a scroll zooms 10% and keeps the point under the cursor", [sc.zoom, q(before), q(after)], [1.1, q(before), q(before)]);
eq("scrolling the other way zooms out", scrollZoom(v, 200, 200, 100, 100, -1).zoom, 0.9);
// expect: ok the origin is in the Mandelbrot set
// expect: ok a point far out escapes at once
// expect: ok a point near the edge takes a few iterations
// expect: ok Julia, classic c: the origin escapes
// expect: ok Julia: far out escapes at once
// expect: ok Julia, dendrite c=(0,1): the origin stays
// expect: ok the origin is not in the Tricorn's escape region either
// expect: ok the Tricorn is symmetric about the real axis: c and its conjugate agree
// expect: ok Burning Ship: far out escapes at once, the origin stays
// expect: ok Newton for z^3 = 1: a root converges at once, far out takes a few more steps
// expect: ok eight palettes, classic first
// expect: ok every palette paints the inside black
// expect: ok grayscale
// expect: ok five explorers and six Julia presets
// expect: ok each kind's start view
// expect: ok zoom 1 spans 3 units across 200 pixels
// expect: ok the middle pixel is the centre
// expect: ok pixel (190, 100) is 0.85 on the real axis
// expect: ok a tap centres on the point and doubles the zoom
// expect: ok zoom in and out, out stopping at 0.5
// expect: ok a pan is 50 pixels
// expect: ok a scroll zooms 10% and keeps the point under the cursor
// expect: ok scrolling the other way zooms out
