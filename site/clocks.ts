// The clocks a page reads: performance.now() and animation-frame timestamps
// are coarse (rounded down to 100 us) in the browser, full resolution in an
// app; SAE_COARSE_CLOCKS=0 / 1 overrides either (docs/roadmap.md, decision
// 1). tests/spec_webrules.ae reads this page in both modes; tests/apps/clocks
// links it as an app.
const out = ui.text("clock: sampling");
// On the 100 us grid: v * 10 is an integer, give or take float noise.
const onGrid = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-4;
const perf: number[] = [];
const t0 = performance.now();
while (performance.now() - t0 < 20) perf.push(performance.now());
let frames = 0;
let rafOnGrid = true;
const tick = (ts: number) => {
  if (!onGrid(ts)) rafOnGrid = false;
  frames++;
  if (frames < 10) requestAnimationFrame(tick);
  else ui.set_text(out, `clock: perf=${perf.every(onGrid) ? "coarse" : "fine"} raf=${rafOnGrid ? "coarse" : "fine"} samples=${perf.length}`);
};
requestAnimationFrame(tick);
