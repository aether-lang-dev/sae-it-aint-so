// Named ranges: name the selection, and the names there are. A name is then
// read in either language's formulas (=SUM(qty), =SUM_RANGE("qty")), and
// the address field goes to it. A name can be a formula's too, a named
// LAMBDA (=LAMBDA(x, x*2)), called as a function. A name is the
// workbook's, read on every sheet, as Excel's are; names.define's
// scope=sheet makes one a sheet's own.
import type { SheetView } from "./view.ts";

export function namesBar(v: SheetView): void {
  const name = state("");
  const refers = state("");
  const list = state("");
  const listed = async (o: Promise<unknown>) => {
    await o;
    list.set([...v.wb.names(), ...v.wb.sheet.names().map(([n, r]) => [`${v.wb.active}!${n}`, r])].map(([n, r]) => `${n} = ${r}`).join(", ") || "No names");
  };
  ui.hstack(() => {
    bind(ui.textfield("name", () => {}), name);
    ui.btn("Name the selection", () => listed(v.run("names.define", { name: name.value, range: v.range() })));
    bind(ui.textfield("refers to =LAMBDA(...)", () => {}), refers);
    ui.btn("Name the formula", () => listed(v.run("names.define", { name: name.value, formula: refers.value })));
    ui.btn("Delete name", () => listed(v.run("names.delete", { name: name.value })));
    bind(ui.text(""), list);
  });
}
