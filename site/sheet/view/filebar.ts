// What to open: the Excel example, the Tauri app's three sample sheets
// (RexxJS formulas), an empty sheet, and the way home.
import type { SheetView } from "./view.ts";

export function fileBar(v: SheetView): void {
  ui.hstack(() => {
    ui.btn("Paste example", () => v.run("example.paste"));
    ui.btn("Budget (RexxJS)", () => v.run("file.open", { sample: "budget" }));
    ui.btn("Test sheet (RexxJS)", () => v.run("file.open", { sample: "test" }));
    ui.btn("Formatted (RexxJS)", () => v.run("file.open", { sample: "formatted" }));
    ui.btn("Clear all", () => v.run("sheet.clear"));
    ui.btn("Home", () => browserContext.changePage("/"));
  });
}
