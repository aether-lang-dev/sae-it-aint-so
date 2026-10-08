// Arms every kind of timer, then leaves. tests/spec_timers.ae checks that
// none of them runs once the page has gone: a page's timers, sleeps and
// animation frames are page-scoped.
const { text, after, sleep, btn } = ui;

let leftAt = 0;
// Anything that runs well after the page was left reports it; the leaving
// itself (a deferred navigation) takes a millisecond or so.
const late = (what: string) => {
  if (leftAt > 0 && performance.now() - leftAt > 100) print(`away: ${what} ran after the page went`);
};

setInterval(() => late("setInterval"), 20);
ui.timer(20, () => late("ui.timer"));
setTimeout(() => late("setTimeout"), 400);
after(400, () => late("ui.after"));
sleep(400).then(() => late("ui.sleep"));
const loop = () => { late("requestAnimationFrame"); requestAnimationFrame(loop); };
requestAnimationFrame(loop);

text("away: armed");
btn("Leave", () => {
  leftAt = performance.now();
  browserContext.changePage("/about");
});
