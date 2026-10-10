// site/keys.ts -- the keyboard, Return, focus, wrapping and text metrics a
// spreadsheet needed (the cloud session's wishlist, 2026-10-10):
// ui.on_key, ui.on_submit, ui.focus, ui.text_wrapped, ui.width/height,
// vg.measure and vg.ellipsize. tests/spec_keys.ae drives it.
const { text, textfield, btn } = ui;

text("Keys");
let keys = 0;
const counter = text("keys: 0");
ui.on_key((key: string, mods: number) => {
  keys++;
  ui.set_text(counter, `keys: ${keys}`);
  print(`keys: ${key} ${mods}`);
});

const field = textfield("a formula");
ui.on_submit(field, (t: string) => print(`submitted: ${t}`));
btn("Focus the field", () => ui.focus(field));

const narrow = ui.text_wrapped("one two three four five six seven eight nine ten eleven twelve", 120);
btn("Sizes", () => print(`wrapped: ${ui.width(narrow)} x ${ui.height(narrow)}`));

const m1 = vg.measure("i", 14);
const m2 = vg.measure("WWWWWWWWWW", 14);
print(`measure: ${m1.width < m2.width} ${m2.ascent > 0} ${m2.descent >= 0} ${m2.height >= m2.ascent}`);
const cut = vg.ellipsize("a rather long cell value", 14, m2.width / 2);
print(`ellipsize: ${cut.endsWith("…")} ${vg.measure(cut, 14).width <= m2.width / 2}`);
print(`ellipsize keeps a short one: ${vg.ellipsize("ok", 14, 500) === "ok"}`);
// A text moved after it was made: vg.set's x and y on a text node.
let moved = 0;
vg.scene("0 0 200 60", 200, 60, () => {
  vg.rect(0, 0, 200, 60, () => vg.fill("#ffffff"));
  moved = vg.text_sized(10, 45, 40, "", () => vg.fill("#000000"));
  vg.set(moved, { text: "M" });
});
btn("Move", () => {
  vg.set(moved, { x: 150 });
  print(`moved: ${vg.get(moved).x}`);
});
btn("Home", () => browserContext.changePage("/"));
