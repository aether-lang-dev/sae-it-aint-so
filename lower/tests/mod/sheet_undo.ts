// site/sheet/workbook.ts's undo: the whole workbook saved before each
// command that changes it, and put back. Looks, notes, rules, charts,
// merges, hidden rows, names, tables and sheets added, renamed or deleted
// are undone as cells are, across sheets, one step a command; what is only
// looked at or copied is no step, and a file opened is where undo stops.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const value = (k: string) => show(wb.sheet.value(k));
const undo = async () => (await cmds.run("edit.undo")).message;
const redo = async () => (await cmds.run("edit.redo")).message;

eq("nothing to undo or redo at first", [wb.canUndo, wb.canRedo, await undo()], [false, false, "undo: 0 changed"]);
await cmds.run("cell.set cell=A1 input=1");
await cmds.run("cell.set cell=A2 input=2");
await cmds.run('cell.set cell=A3 input="=A1+A2"');
eq("cells, as before", [await undo(), wb.sheet.input("A3"), await redo(), value("A3")], ["undo: 1 changed", "", "redo: 1 changed", "3"]);

// Each of these was the sheet's own to keep, and not undone.
const look = () => [wb.notes.get("A1").look ?? null, wb.notes.get("A1").comment ?? "", wb.merges(), wb.hidden().rows, wb.charts().length,
  wb.page(wb.active)!.rules.length, wb.sheet.names().length, wb.sheet.tables().length];
const plain = look();
for (const line of ["format.font range=A1 bold=1", "cell.comment cell=A1 text=first", "cells.merge range=B1:C1", "rows.hide range=A5",
  "chart.insert kind=bar range=A1:A3", 'format.highlight range=A1:A3 op=">" value=1', "names.define name=TOP range=A1", "table.define name=T range=A1:A3"]) {
  const o = await cmds.run(line);
  if (!o.ok) throw new Error(`${line}: ${o.message}`);
}
const dressed = look();
for (let i = 0; i < 8; i++) await undo();
eq("a look, a comment, a merge, a hidden row, a chart, a rule, a name and a table: each one undo", look(), plain);
for (let i = 0; i < 8; i++) await redo();
eq("and each one redo", look(), dressed);

// Sheets: added, renamed and deleted, and what reads them.
await cmds.run("sheet.add name=Costs");
await cmds.run("cell.set cell=B1 input=40");
await cmds.run("sheet.activate name=Sheet1");
await cmds.run('cell.set cell=D1 input="=Costs!B1+1"');
eq("a formula reads another sheet", value("D1"), "41");
await cmds.run("sheet.rename name=Costs to=Prices");
eq("renamed, and what reads it follows", [wb.sheetNames(), wb.sheet.input("D1")], [["Sheet1", "Prices"], "=Prices!B1+1"]);
await undo();
eq("undone: the old name, and the formula as it was", [wb.sheetNames(), wb.sheet.input("D1"), value("D1")], [["Sheet1", "Costs"], "=Costs!B1+1", "41"]);
await cmds.run("sheet.delete name=Costs");
eq("deleted, and what read it is #REF!", [wb.sheetNames(), value("D1")], [["Sheet1"], "#REF!"]);
await undo();
eq("undone: the sheet back with its cells, and read again", [wb.sheetNames(), wb.page("Costs")!.sheet.input("B1"), value("D1")], [["Sheet1", "Costs"], "40", "41"]);

// Undo goes to the sheet the change was on.
await cmds.run("sheet.activate name=Costs");
await cmds.run("cell.set cell=B1 input=50");
await cmds.run("sheet.activate name=Sheet1");
eq("a change on another sheet reads through", value("D1"), "51");
await undo();
eq("undone from Sheet1: Costs is active, and B1 is as it was", [wb.active, wb.sheet.input("B1"), wb.page("Sheet1")!.sheet.value("D1")], ["Costs", "40", 41]);

// Not steps: a copy, going to a sheet, Circle Invalid, and refusals.
const steps = async () => {
  let n = 0;
  for (; wb.canUndo; n++) await cmds.run("edit.undo");
  for (let i = 0; i < n; i++) await cmds.run("edit.redo");
  return n;
};
const before = await steps();
await cmds.run("edit.copy range=A1:A3");
await cmds.run("sheet.activate name=Sheet1");
await cmds.run("validation.circle");
await cmds.run("cell.set cell=AA99 input=1");
eq("a copy, going to a sheet, circles and a refusal add no step", await steps(), before);

await cmds.run("cell.set cell=E1 input=7");
await undo();
await cmds.run("cell.set cell=E2 input=8");
eq("a new change forgets what could be redone", wb.canRedo, false);

for (let i = 0; i < 105; i++) await cmds.run(`cell.set cell=F1 input=${i}`);
eq("a hundred steps are kept", await steps(), 100);

await cmds.run("file.open sample=test");
eq("a file opened is where undo stops", [wb.canUndo, wb.canRedo], [false, false]);
await cmds.run("file.new");
eq("so is a new one", wb.canUndo, false);

// expect: ok nothing to undo or redo at first
// expect: ok cells, as before
// expect: ok a look, a comment, a merge, a hidden row, a chart, a rule, a name and a table: each one undo
// expect: ok and each one redo
// expect: ok a formula reads another sheet
// expect: ok renamed, and what reads it follows
// expect: ok undone: the old name, and the formula as it was
// expect: ok deleted, and what read it is #REF!
// expect: ok undone: the sheet back with its cells, and read again
// expect: ok a change on another sheet reads through
// expect: ok undone from Sheet1: Costs is active, and B1 is as it was
// expect: ok a copy, going to a sheet, circles and a refusal add no step
// expect: ok a new change forgets what could be redone
// expect: ok a hundred steps are kept
// expect: ok a file opened is where undo stops
// expect: ok so is a new one
