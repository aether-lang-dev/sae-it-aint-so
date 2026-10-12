// What-if and data tools over the selection, as Excel's Data tab has them:
// Goal Seek (the selected formula to the goal, by changing a cell), Data
// Table (the selection, with a row input, a column input, or both), Remove
// Duplicates, Text to Columns (split at the delimiter, a comma by default).
import type { SheetView } from "./view.ts";

export function dataBar(v: SheetView): void {
  const goal = state(""), by = state(""), rowInput = state(""), columnInput = state(""), delimiter = state("");
  const given = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x.trim() !== ""));
  ui.hstack(() => {
    bind(ui.textfield("goal", () => {}), goal);
    bind(ui.textfield("by changing", () => {}), by);
    ui.btn("Goal seek", () => v.run("data.goalSeek", { set: v.here(), to: goal.value, by: by.value }));
    bind(ui.textfield("row input", () => {}), rowInput);
    bind(ui.textfield("column input", () => {}), columnInput);
    ui.btn("Data table", () => v.run("data.table", { range: v.range(), ...given({ row: rowInput.value, column: columnInput.value }) }));
    ui.btn("Remove duplicates", () => v.run("data.removeDuplicates", { range: v.range() }));
    bind(ui.textfield("delimiter", () => {}), delimiter);
    ui.btn("Text to columns", () => v.run("data.textToColumns", { range: v.range(), ...given({ delimiter: delimiter.value }) }));
  });
}
