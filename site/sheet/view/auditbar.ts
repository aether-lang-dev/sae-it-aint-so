// Formula auditing, as Excel's Formulas tab has it: trace what the selected
// cell reads (blue) or what reads it (orange), a level further each time;
// remove the arrows; Show Formulas (on, then off); Evaluate Formula's steps; and the Watch
// Window, the cells watched on any sheet as they change.
import type { Watch } from "../workbook.ts";
import type { SheetView } from "./view.ts";

export function auditBar(v: SheetView): void {
  const steps = state("");
  ui.hstack(() => {
    ui.btn("Trace precedents", () => v.run("formulas.tracePrecedents", { cell: v.here() }));
    ui.btn("Trace dependents", () => v.run("formulas.traceDependents", { cell: v.here() }));
    ui.btn("Remove arrows", () => v.run("formulas.removeArrows"));
    ui.btn("Show formulas", () => v.run("formulas.showFormulas", v.wb.showFormulas ? { off: "1" } : {}));
    ui.btn("Evaluate formula", async () => {
      const o = await v.run("formulas.evaluate", { cell: v.here() });
      steps.set(o.ok ? o.message : "");
    });
    ui.btn("Add watch", () => v.run("formulas.watch", { cell: v.here() }));
  });
  bind(ui.text_wrapped("", 720), steps);
  each(v.watches, (w: Watch) => `${w.sheet}!${w.cell}`, (w: Watch) => ui.hstack(() => {
    ui.text(`Watch ${w.sheet}!${w.cell}: ${w.input} = ${w.shown}`);
    ui.btn(`Unwatch ${w.sheet}!${w.cell}`, () => v.run("formulas.unwatch", { cell: `${w.sheet}!${w.cell}` }));
  }));
}
