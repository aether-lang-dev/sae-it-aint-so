// The workbook's sheets, as tabs: one button each (the active one named
// beside them), and a sheet's name to add one by; Delete sheet deletes the
// active one, as Excel's does. A formula reads another sheet's cells as
// Costs!B2 (Excel) or Costs_B2 (RexxJS).
import type { SheetView } from "./view.ts";

export function sheetTabs(v: SheetView): void {
  const name = state("");
  ui.hstack(() => {
    bind(ui.text(""), computed(() => `On ${v.active.value}:`, v.active));
    each(v.sheets, (n: string) => n, (n: string) => ui.btn(n, () => v.run("sheet.activate", { name: n })));
    bind(ui.textfield("sheet", () => {}), name);
    ui.btn("Add sheet", () => v.run("sheet.add", name.value.trim() ? { name: name.value } : {}));
    ui.btn("Delete sheet", () => v.run("sheet.delete", { name: v.active.value }));
  });
}
