// Attempt: open a second window, by any name the toolkit or the web has.
// Expected: none exists; each throws or is undefined.
const out = ui.text("second_window: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const g: any = globalThis;
const u: any = ui;
const tries: (() => any)[] = [
  () => u.window("pwned", 300, 200, () => {}),
  () => u.popup("pwned"),
  () => g.open("http://localhost:8091/"),
  () => new g.Window(),
  () => g.window.open("http://localhost:8091/"),
];
let opened = 0;
for (const t of tries) { try { if (t() !== undefined) opened++; } catch (e) { /* refused */ } }
report(opened === 0 ? `second_window: refused: ${tries.length} ways, none open` : `second_window: ESCAPED ${opened}`);
