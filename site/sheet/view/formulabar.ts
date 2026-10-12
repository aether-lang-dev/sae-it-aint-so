// The formula bar: the selected cell's address and what was typed into it,
// both bound two-way. The address is also the Name Box: Return on a named
// range's name selects it; Return on a cell moves to the formula. Return in
// the formula sets the cell.
import { addrOf } from "../address.ts";
import type { SheetView } from "./view.ts";

export function formulaBar(v: SheetView): void {
  ui.hstack(() => {
    const cell = bind(ui.textfield("cell", () => {}), v.address);
    const formula = bind(ui.textfield("formula", () => {}), v.input);
    ui.on_submit(cell, () => {
      const named = v.wb.sheet.name(v.address.value.trim());
      if (!named) return ui.focus(formula);
      const name = v.address.value.trim().toUpperCase();
      v.select(named);
      v.status.set(`${name} is ${v.wb.sheet.names().find(([n]) => n === name)![1]}`);
    });
    ui.on_submit(formula, () => {
      if (addrOf(v.address.value)) v.run("cell.set", { cell: v.here(), input: v.input.value.trim() });
      else v.status.set(`${v.address.value}: not a cell on this sheet`);
    });
  });
}
