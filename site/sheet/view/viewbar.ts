// Rows and columns out of view, over the selection, as Excel has them: Hide
// and Unhide rows and columns; a filter on the selected column of the
// selection's table (the criterion as COUNTIF writes one: >100, north,
// <>x), Clear filter; Freeze top row and Unfreeze; the selection's rows set
// to a height (empty or 0: the grid's).
import { addrOf, colName } from "../address.ts";
import type { SheetView } from "./view.ts";

export function viewBar(v: SheetView): void {
  const criterion = state(""), height = state("");
  ui.hstack(() => {
    ui.btn("Hide rows", () => v.run("rows.hide", { range: v.range() }));
    ui.btn("Unhide rows", () => v.run("rows.unhide", { range: v.range() }));
    ui.btn("Hide columns", () => v.run("columns.hide", { range: v.range() }));
    ui.btn("Unhide columns", () => v.run("columns.unhide", { range: v.range() }));
    bind(ui.textfield("filter by", () => {}), criterion);
    ui.btn("Filter", () => v.run("data.filter", { range: v.range(), column: colName(addrOf(v.here())!.col), criterion: criterion.value }));
    ui.btn("Clear filter", () => v.run("data.clearFilter"));
    ui.btn("Freeze top row", () => v.run("view.freezeRows", { count: "1" }));
    ui.btn("Unfreeze", () => v.run("view.freezeRows", { count: "0" }));
    bind(ui.textfield("row height", () => {}), height);
    ui.btn("Row height", () => v.run("rows.height", { range: v.range(), height: height.value.trim() || "0" }));
  });
}
