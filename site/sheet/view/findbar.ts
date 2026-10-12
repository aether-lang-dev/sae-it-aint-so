// Find and replace, with the Tauri app's three options. Find lists the
// matches and selects the next after the selected cell.
import { addrOf, order } from "../address.ts";
import type { SheetView } from "./view.ts";

export function findBar(v: SheetView): void {
  const text = state(""), by = state("");
  const options = { matchCase: false, wholeCell: false, inFormulas: false };
  const params = () => ({ text: text.value, matchCase: String(options.matchCase), wholeCell: String(options.wholeCell), inFormulas: String(options.inFormulas) });
  const find = async () => {
    const o = await v.run("edit.find", params());
    const keys = (o.output ?? []) as string[];
    const next = keys.find((k) => order(addrOf(k)!) > order(addrOf(v.here())!)) ?? keys[0];
    if (next) v.address.set(next);
    v.status.set(keys.length ? `${keys.length} found: ${keys.join(", ")}` : `"${text.value}" not found`);
  };
  ui.hstack(() => {
    bind(ui.textfield("find", () => {}), text);
    bind(ui.textfield("replace with", () => {}), by);
    ui.btn("Find", find);
    ui.btn("Replace all", () => v.run("edit.replace", { ...params(), with: by.value }));
    ui.toggle("Match case", (on: boolean) => { options.matchCase = !!on; });
    ui.toggle("Whole cell", (on: boolean) => { options.wholeCell = !!on; });
    ui.toggle("In formulas", (on: boolean) => { options.inFormulas = !!on; });
  });
}
