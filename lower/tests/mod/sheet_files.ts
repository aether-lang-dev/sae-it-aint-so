// Saving and opening (site/sheet/file.ts's writeSheetFile, and the file.*
// commands over a Store: the page's `storage`, a fake here that records
// what it was told), and CSV in and out.
import { Commands } from "./sheet/commands.ts";
import type { Store } from "./sheet/commands.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

// A Store in memory that logs each call, and holds keys to storage's rule.
const fakeStore = () => {
  const data = new Map<string, string>(), calls: string[] = [];
  const ok = (k: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new TypeError(`storage key must be letters, digits, '.', '_' or '-': ${k}`);
    return k;
  };
  const store: Store = {
    get: (k) => { calls.push(`get ${ok(k)}`); return data.get(k) ?? null; },
    set: (k, v) => { calls.push(`set ${ok(k)}`); data.set(k, v); },
    remove: (k) => { calls.push(`remove ${ok(k)}`); data.delete(k); },
  };
  return { store, data, calls };
};

const { store, data, calls } = fakeStore();
const wb = new Workbook();
const cmds = new Commands(wb, store);
const message = async (line: string) => (await cmds.run(line)).message;
for (const line of [
  "cell.set cell=A1 input=Item", "cell.set cell=B1 input=2", 'cell.set cell=B2 input="=B1*21"', "cell.comment cell=B2 text=answer",
  "cell.format cell=B1 format=number:0.00", "validation.set range=B1 kind=whole min=0", "names.define name=two range=B1",
  "sheet.add name=Costs", 'cell.set cell=A1 input="=Sheet1!B2+1"', "sheet.activate name=Sheet1",
]) await cmds.run(line);

const file = writeSheetFile(wb);
eq("written in the Tauri app's shapes: text as itself, a formula as value and expression, notes beside them", [file.cells.A1, file.cells.B1, file.cells.B2],
  ["Item", { value: "2", format: "number:0.00", validation: { kind: "whole", min: 0, mode: "stop", when: "always" } }, { value: "42", expression: "B1*21", comment: "answer" }]);
eq("with its language, its names, and the other sheets", [file.formulas, file.sheetName, file.names, file.sheets],
  ["excel", "Sheet1", { TWO: "B1" }, [{ name: "Costs", cells: { A1: { value: "43", expression: "Sheet1!B2+1" } }, names: {}, rules: [], charts: [], view: { hiddenRows: [], hiddenCols: [], frozenRows: 0 } }]]);
const read = readSheetFile(JSON.parse(JSON.stringify(file)));
eq("and read back", [read.language, read.sheets.map((s) => [s.name, s.entries, s.names])],
  ["Excel", [["Sheet1", [["A1", "Item"], ["B1", "2"], ["B2", "=B1*21"]], [["TWO", "B1"]]], ["Costs", [["A1", "=Sheet1!B2+1"]], []]]]);
eq("a rule read back is a rule", read.sheets[0].notes.get("B1"), { format: "number:0.00", validation: { kind: "whole", min: 0, mode: "stop", when: "always" } });

calls.length = 0;
eq("file.save: under its name, and in the list of files", [await message("file.save name=Budget"), calls, wb.name],
  ["saved Budget: 2 sheets, 4 cells", ["set sheet.file.Budget", "get sheet.files", "set sheet.files"], "Budget"]);
eq("what is stored is the file", JSON.parse(data.get("sheet.file.Budget")!).sheets[0].name, "Costs");
await cmds.run("file.save name=Other");
eq("a name with more than letters and digits, in a key storage takes", [await message('file.save name="My book-2"'), data.has("sheet.file.My_0020book_002d2")],
  ["saved My book-2: 2 sheets, 4 cells", true]);
await cmds.run('file.delete name="My book-2"');
eq("file.list", (await cmds.run("file.list")).output, ["Budget", "Other"]);

{
  const again = new Workbook();
  const other = new Commands(again, store);
  eq("file.open: a saved file, any case, every sheet, worked out", [await (await other.run("file.open name=budget")).message, again.sheetNames(), again.active, show(again.sheet.value("B2"))],
    ["opened Budget: 4 cells, Excel formulas", ["Sheet1", "Costs"], "Sheet1", "42"]);
  await other.run("sheet.activate name=Costs");
  eq("its references between sheets", show(again.sheet.value("A1")), "43");
  await other.run("sheet.activate name=Sheet1");
  eq("its notes, rules and names", [again.notes.get("B2").comment, await (await other.run("cell.set cell=B1 input=-1")).message, again.sheet.names()],
    ["answer", "B1 must be a whole number of at least 0", [["TWO", "B1"]]]);
}
eq("refusals: no such file, no sample, both", [await message("file.open name=Nope"), await message("file.open sample=nope"), await message("file.open")],
  ["no saved file Nope", "no sample nope (budget, test, formatted)", "file.open needs a name or a sample"]);
eq("file.delete", [await message("file.delete name=other"), (await cmds.run("file.list")).output, data.has("sheet.file.Other")], ["deleted Other", ["Budget"], false]);

eq("file.exportCsv: what the cells show, of a range", (await cmds.run("file.exportCsv range=A1:B2")).output, "Item,2.00\n,42");
eq("or of everything used", (await cmds.run("file.exportCsv")).output, "Item,2.00\n,42");
eq("file.importCsv: fields as inputs, at a cell", [await message('file.importCsv at=D1 text="x,1\n""a,b"",=E1*2"'), show(wb.sheet.value("E2")), wb.sheet.input("D2")],
  ["imported 2 rows at D1: 4 cells set, 4 changed", "2", "a,b"]);
eq("one that does not fit is refused", await message('file.importCsv at=J20 text="1,2"'), "2 columns from J20 do not fit on the sheet");
eq("file.new: one empty sheet, Untitled", [await message("file.new"), wb.sheetNames(), wb.sheet.keys(), wb.name], ["a new workbook", ["Sheet1"], [], "Untitled"]);
// expect: ok written in the Tauri app's shapes: text as itself, a formula as value and expression, notes beside them
// expect: ok with its language, its names, and the other sheets
// expect: ok and read back
// expect: ok a rule read back is a rule
// expect: ok file.save: under its name, and in the list of files
// expect: ok what is stored is the file
// expect: ok a name with more than letters and digits, in a key storage takes
// expect: ok file.list
// expect: ok file.open: a saved file, any case, every sheet, worked out
// expect: ok its references between sheets
// expect: ok its notes, rules and names
// expect: ok refusals: no such file, no sample, both
// expect: ok file.delete
// expect: ok file.exportCsv: what the cells show, of a range
// expect: ok or of everything used
// expect: ok file.importCsv: fields as inputs, at a cell
// expect: ok one that does not fit is refused
// expect: ok file.new: one empty sheet, Untitled
