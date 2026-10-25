// A page that builds part of itself again, many times: the callbacks the old
// widgets held must go with them (performance.handlesHeld() is how many the
// host keeps for the page). "Rebuild" builds the row 100 times over (clear,
// into: a button, a field, a toggle, a context menu) and says how many were
// held before and after; "Self" is a button of the row whose own handler
// rebuilds the row, destroying itself while it runs.
const { vstack, hstack, text, btn, textfield, toggle, context_menu, set_text, clear, into } = ui;

let presses = 0;
let selfs = 0;
const status = text("presses: 0");
const handles = text("handles: ?");
const row = vstack(2, () => {});

const build = (): void => {
  into(row, () => {
    hstack(2, () => {
      const b = btn("Press", () => { presses++; set_text(status, `presses: ${presses}`); });
      textfield("name", (s: string) => {});
      toggle("on", (on: number) => {});
      btn("Self", () => { clear(row); build(); selfs++; set_text(handles, `self: ${selfs}`); });
      context_menu(b, [{ label: "One", action: () => {} }, { label: "Two", action: () => {} }]);
    });
  });
};

btn("Rebuild", () => {
  const before = performance.handlesHeld();
  for (let i = 0; i < 100; i++) { clear(row); build(); }
  print(`held: ${performance.handlesHeld() - before}`);
  set_text(handles, "handles: rebuilt");
});

build();
