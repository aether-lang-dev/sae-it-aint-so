// Undo and redo, sorting the selection by the cursor's column, rows or
// columns inserted before the selection (as many as it covers) or deleted;
// then Fill Series and AutoSum, Paste Special (what was copied, at the
// selection), and the Clears.
import { addrOf, colName } from "../address.ts";
import type { SheetView } from "./view.ts";

export function editBar(v: SheetView): void {
  // The selection's rows or columns: where they start, and how many.
  const span = (axis: "row" | "col") => {
    const s = v.selection() ?? [addrOf(v.here())!, addrOf(v.here())!];
    const lo = Math.min(s[0][axis], s[1][axis]);
    return { at: axis === "row" ? String(lo + 1) : colName(lo), count: String(Math.abs(s[0][axis] - s[1][axis]) + 1) };
  };
  const sort = (id: string) => {
    const s = v.selection();
    if (!s || s[0].row === s[1].row) {
      v.status.set("Select the rows to sort, the cursor in the column to sort them by");
      return;
    }
    v.run(id, { range: v.range(), by: colName(addrOf(v.here())!.col) });
  };
  ui.hstack(() => {
    ui.btn("Undo", () => v.run("edit.undo"));
    ui.btn("Redo", () => v.run("edit.redo"));
    ui.btn("Sort A→Z", () => sort("data.sortAscending"));
    ui.btn("Sort Z→A", () => sort("data.sortDescending"));
    ui.btn("Insert row", () => v.run("rows.insert", span("row")));
    ui.btn("Delete row", () => v.run("rows.delete", span("row")));
    ui.btn("Insert column", () => v.run("columns.insert", span("col")));
    ui.btn("Delete column", () => v.run("columns.delete", span("col")));
  });
  const at = () => v.range().split(":")[0];
  ui.hstack(() => {
    ui.btn("Fill series", () => v.run("edit.fillSeries", { range: v.range() }));
    ui.btn("AutoSum", () => v.run("formulas.autoSum", { cell: v.here() }));
    ui.btn("Paste values", () => v.run("edit.pasteSpecial", { at: at(), what: "values" }));
    ui.btn("Paste formats", () => v.run("edit.pasteSpecial", { at: at(), what: "formats" }));
    ui.btn("Paste transposed", () => v.run("edit.pasteSpecial", { at: at(), what: "all", transpose: "true" }));
    ui.btn("Clear formats", () => v.run("range.clearFormats", { range: v.range() }));
    ui.btn("Clear comments", () => v.run("range.clearComments", { range: v.range() }));
    ui.btn("Clear cells", () => v.run("range.clearAll", { range: v.range() }));
  });
}
