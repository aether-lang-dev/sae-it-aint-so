// Named ranges: name the selection, and the names there are. A name is then
// read in either language's formulas (=SUM(qty), =SUM_RANGE("qty")), and
// the address field goes to it.
import type { SheetView } from "./view.ts";

export function namesBar(v: SheetView): void {
  const name = state("");
  const list = state("");
  const listed = async (o: Promise<unknown>) => {
    await o;
    list.set(v.wb.sheet.names().map(([n, r]) => `${n} = ${r}`).join(", ") || "No names");
  };
  ui.hstack(() => {
    bind(ui.textfield("name", () => {}), name);
    ui.btn("Name the selection", () => listed(v.run("names.define", { name: name.value, range: v.range() })));
    ui.btn("Delete name", () => listed(v.run("names.delete", { name: name.value })));
    bind(ui.text(""), list);
  });
}
