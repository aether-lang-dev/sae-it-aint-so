// The formula bar: the selected cell's address and what was typed into it,
// both bound two-way. Return in the address moves to the formula; Return in
// the formula sets the cell.
import { addrOf } from "../address.ts";
import type { SheetView } from "./view.ts";

export function formulaBar(v: SheetView): void {
  ui.hstack(() => {
    const cell = bind(ui.textfield("cell", () => {}), v.address);
    const formula = bind(ui.textfield("formula", () => {}), v.input);
    ui.on_submit(cell, () => ui.focus(formula));
    ui.on_submit(formula, () => {
      if (addrOf(v.address.value)) v.run("cell.set", { cell: v.here(), input: v.input.value.trim() });
      else v.status.set(`${v.address.value}: not a cell on this sheet`);
    });
  });
}
