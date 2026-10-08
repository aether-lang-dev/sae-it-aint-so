// Timers: ui.after, ui.sleep, ui.frame and the web's names for them
// (setTimeout, setInterval, clearTimeout, clearInterval,
// requestAnimationFrame, cancelAnimationFrame). tests/spec_timers.ae reads
// the "name: value" lines below. Every one is page-scoped: it needs no grant
// and stops when the page goes (site/timers_away.ts checks that part).
const { text, set_text, after, sleep, timer_cancel, frame, btn } = ui;

const line = (name: string) => {
  const h = text(`${name}: -`);
  return (v: any) => set_text(h, `${name}: ${v}`);
};

// A one-shot runs exactly once: plainly, when it throws, and when it is
// slower than its own delay.
let once = 0;
const onceL = line("once");
after(20, () => { once++; onceL(once); });
let thrown = 0;
const throwL = line("throws");
after(20, () => { thrown++; throwL(thrown); throw new Error("boom from a one-shot"); });
let slow = 0;
const slowL = line("slow");
setTimeout(() => {
  slow++;
  const t = performance.now();
  while (performance.now() - t < 120) { /* slower than the delay */ }
  slowL(slow);
}, 5);

// Cancelled before its time: never runs. Ids are shared, so either cancel
// takes either kind.
let cancelled = 0;
const cancelL = line("cancelled");
cancelL(0);
timer_cancel(after(60, () => { cancelled++; cancelL(cancelled); }));
clearTimeout(setTimeout(() => { cancelled++; cancelL(cancelled); }, 30));
clearInterval(setTimeout(() => { cancelled++; cancelL(cancelled); }, 30));
clearTimeout(setInterval(() => { cancelled++; cancelL(cancelled); }, 30));

// Order: by due time, then by the order they were set.
const order: string[] = [];
const orderL = line("order");
setTimeout(() => order.push("a"), 15);
setTimeout(() => order.push("b"), 15);
setTimeout(() => order.push("c"), 0);
setTimeout(() => { order.push("d"); orderL(order.join("")); }, 40);

// ui.sleep resolves in order of its delay, and composes with await.
const sleepL = line("sleep");
(async () => {
  const seen: string[] = [];
  await Promise.all([
    sleep(60).then(() => seen.push("60")),
    sleep(20).then(() => seen.push("20")),
    sleep(0).then(() => seen.push("0")),
  ]);
  const t0 = performance.now();
  await sleep(50);
  seen.push(performance.now() - t0 >= 45 ? "waited" : "early");
  sleepL(seen.join(","));
})();

// Extra arguments go to the callback, for setTimeout and setInterval alike.
const argsL = line("args");
setTimeout((a: string, b: number, c: boolean) => argsL(`${a} ${b} ${c}`), 10, "x", 2, true);

// setInterval runs until clearInterval, here from inside its own callback.
let ticks = 0;
const ivL = line("interval");
const iv = setInterval((step: number) => {
  ticks += step;
  ivL(ticks);
  if (ticks >= 3) clearInterval(iv);
}, 15, 1);

// requestAnimationFrame: once per call, again when re-requested, with an
// increasing high-resolution timestamp on performance.now()'s clock.
let frames = 0;
let last = -1;
let increasing = true;
let nearNow = true;
let fractional = false;
const rafL = line("raf");
const tick = (ts: number) => {
  frames++;
  if (ts <= last) increasing = false;
  if (Math.abs(performance.now() - ts) > 50) nearNow = false;
  if (ts !== Math.floor(ts)) fractional = true;
  last = ts;
  if (frames < 10) requestAnimationFrame(tick);
  else rafL(`${frames} ${increasing ? "increasing" : "NOT increasing"} ${nearNow ? "near-now" : "far"} ${fractional ? "fractional" : "whole"}`);
};
requestAnimationFrame(tick);

// cancelAnimationFrame: before its frame, and from an earlier callback in
// the same frame.
let rafCancelled = 0;
const rafCancelL = line("raf-cancelled");
rafCancelL(0);
cancelAnimationFrame(requestAnimationFrame(() => { rafCancelled++; rafCancelL(rafCancelled); }));
let victim = 0;
requestAnimationFrame(() => cancelAnimationFrame(victim));
victim = requestAnimationFrame(() => { rafCancelled++; rafCancelL(rafCancelled); });

// ui.frame is requestAnimationFrame's ui name.
const uiFrameL = line("ui.frame");
frame((ts: number) => uiFrameL(typeof ts));

btn("Leave timers", () => browserContext.changePage("/timers_away"));
