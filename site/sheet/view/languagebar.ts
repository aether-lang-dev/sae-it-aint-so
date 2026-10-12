// The major setting: the formula language, Excel or RexxJS.
import type { SheetView } from "./view.ts";

export function languageBar(v: SheetView): void {
  ui.hstack(() => {
    bind(ui.text(""), computed(() => `${v.formulas.value} formulas`, v.formulas));
    ui.btn("Excel formulas", () => v.run("formulas.use", { language: "Excel" }));
    ui.btn("RexxJS formulas", () => v.run("formulas.use", { language: "RexxJS" }));
  });
}
