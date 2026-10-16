"seeks native calc";
// The natives demo app (tests/spec_app_natives.ae, docs/natives.md): the
// app's own Aether module, compiled into its own sae, called as
// natives.calc.<function>(text), each a promise answered off the UI thread.
const { text, btn, set_text } = ui;
text(`natives: ${typeof natives} calc: ${typeof natives?.calc} functions: ${Object.keys(natives?.calc ?? {}).join(",")}`);
const out = text("result: (none)");
const show = (s: string) => set_text(out, `result: ${s}`);
const fail = (e: unknown) => show(`error: ${e instanceof Error ? e.message : String(e)}`);
let ticks = 0;
const tick = text("ticks: 0");
// The page's own work while a call runs: a counter it bumps by a button.
btn("Bump", () => set_text(tick, `ticks: ${++ticks}`));

btn("Sum", async () => show(`sum ${await natives.calc.sum("1 2 3 39")}`));
btn("Upper", async () => show(`upper ${await natives.calc.upper("chess")}`));
btn("Spin", async () => {
  show("spinning");
  const t0 = Date.now();
  const n = await natives.calc.spin("12000000");
  show(`spin ${n} primes, ticks ${ticks}, ${Date.now() - t0 > 0 ? "took time" : "at once"}`);
});
btn("Refuse", () => natives.calc.refuse("this").then(show, fail));
btn("Hidden", () => {
  try {
    show(`hidden is ${typeof (natives.calc as any).hidden}`);
  } catch (e) {
    fail(e);
  }
});
btn("In order", async () => {
  const all = await Promise.all([natives.calc.sum("1"), natives.calc.sum("2"), natives.calc.upper("x"), natives.calc.sum("3")]);
  show(`in order ${all.join(" ")}`);
});
