// An app page that tries to navigate out of its bundle: app:/../../x maps
// onto <dir>/../../x.ts. Expected: refused and logged once; this page stays
// (a dead end in app mode, which has no chrome: spec_app_climb is last-only).
const out = ui.text("climb: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
ui.btn("Climb", () => {
  browserContext.changePage("../../escape/other_storage");
  setTimeout(() => report("climb: refused: still here 200 ms after asking for ../../escape/other_storage"), 200);
});
ui.btn("Dots within", () => browserContext.changePage("./sub/../second"));
