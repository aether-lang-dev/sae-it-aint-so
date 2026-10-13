// The rest of the Tauri app's control functions (site/sheet/control.ts),
// as sheet_control has the first: each against a stubbed exec, then through
// a Workbook and its commands.
import { CONTROL, controlFunctions } from "./sheet/control.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";
import { failed, told as toldBy } from "./lib/controlstub.ts";

const told = (name: string, args: unknown[], answers: Record<string, unknown> = {}) => toldBy(CONTROL, name, args, answers);

// The file, formulas without a cell, the setup script.
eq("EXPORT, IMPORT, EVALUATE, RECALCULATE and the setup script's three tell their commands", [
  await told("EXPORT", [], { "file.export": "{}" }), await told("IMPORT", ["{}"]), await told("EVALUATE", ["A1*2"], { "formulas.calculate": 4 }),
  await told("RECALCULATE", [], { "formulas.recalculate": 3 }), await told("GETSETUPSCRIPT", [], { "setup.get": "LET R = 1" }),
  await told("SETSETUPSCRIPT", ["LET R = 1"]), await told("EXECUTESETUPSCRIPT", []),
], [
  ["{}", [["file.export", {}]]], ["OK", [["file.import", { text: "{}" }]]], [4, [["formulas.calculate", { formula: "A1*2" }]]],
  [3, [["formulas.recalculate", {}]]], ["LET R = 1", [["setup.get", {}]]], ["OK", [["setup.set", { text: "LET R = 1" }]]], ["OK", [["setup.run", {}]]],
]);

const wb = new Workbook();
const cmds = new Commands(wb);
const exec = (id: string, params: Record<string, string>) => cmds.execute(id, params);
const fns = controlFunctions(exec, {});
for (const [k, v] of [["A1", "2"], ["A2", "3"], ["B1", "=A1*10"]]) await cmds.run(`cell.set cell=${k} input=${v}`);
eq("EVALUATE: a formula worked out against the sheet, no cell set; an error says why", [await fns.EVALUATE("SUM(A1:A2)"), await fns.EVALUATE("=A1&\"x\""), await failed(() => fns.EVALUATE("1/0")), wb.sheet.keys().sort()],
  [5, "2x", "=1/0 → #DIV/0! (divide by zero)", ["A1", "A2", "B1"]]);
eq("RECALCULATE: how many formulas it worked out", await fns.RECALCULATE(), 1);

await cmds.run("formulas.use language=RexxJS");
await cmds.run("cell.set cell=C1 input=\"=RATE * A1\"");
await fns.SETSETUPSCRIPT("LET RATE = 7");
eq("SETSETUPSCRIPT keeps it; EXECUTESETUPSCRIPT runs it and works everything out again", [show(wb.sheet.value("C1")), await fns.GETSETUPSCRIPT(), await fns.EXECUTESETUPSCRIPT(), show(wb.sheet.value("C1"))],
  ["#ERROR!", "LET RATE = 7", "OK", "14"]);
await fns.SETSETUPSCRIPT("LET RATE = 1/0");
eq("a setup script that fails, says why", await failed(() => fns.EXECUTESETUPSCRIPT()), "the setup script failed: Division by zero");
await fns.SETSETUPSCRIPT("LET RATE = 7");

const exported = await fns.EXPORT() as string;
const other = new Workbook();
const into = controlFunctions((id, params) => new Commands(other).execute(id, params), {});
eq("EXPORT gives the file's JSON; IMPORT opens it, setup script and all", [await into.IMPORT(exported), ["A1", "B1", "C1"].map((k) => show(other.sheet.value(k))), other.setupScript],
  ["OK", ["2", "20", "14"], "LET RATE = 7"]);
eq("IMPORT of what is not a sheet file", await failed(() => into.IMPORT("{nope")), "not a sheet file: " + (() => { try { JSON.parse("{nope"); } catch (e) { return (e as Error).message; } })());

eq("BATCH_SET_CELLS: each set that can be, and a summary", [JSON.parse(await fns.BATCH_SET_CELLS('[{"address":"D1","value":"5"},{"address":"Z99","value":"1"},{"address":"D2","value":"=D1+1"}]') as string), show(wb.sheet.value("D2"))],
  [{ total: 3, success: 2, errors: 1, errorDetails: [{ address: "Z99", error: "Z99 is not a cell on the sheet" }] }, "6"]);
const said: string[] = [];
await cmds.script(`LET r = BATCH_EXECUTE('[{"command":"setcell","args":["E1","9"]},{"command":"INSERTROW","args":[1]},{"command":"NOPE","args":[]},{"command":"INSERTROW","args":[0]}]'); SAY r`, (l) => said.push(l));
eq("BATCH_EXECUTE: each by any name a script has, SETCELL too; what each gave or why not", [JSON.parse(said[0]), show(wb.sheet.value("E2"))], [[
  { index: 0, command: "SETCELL", success: true, result: "9" }, { index: 1, command: "INSERTROW", success: true, result: "OK" },
  { index: 2, command: "NOPE", success: false, error: "Unknown command: NOPE" }, { index: 3, command: "INSERTROW", success: false, error: "INSERTROW needs a row number (e.g. 2)" },
], "9"]);

// Fills, widths, the filter.
const wb2 = new Workbook();
const cmds2 = new Commands(wb2);
const fns2 = controlFunctions((id, params) => cmds2.execute(id, params), {});
for (const [k, v] of [["B5", "=A5+1"], ["E1", "7"], ["E2", "=E1*2"]]) await cmds2.run(`cell.set cell=${k} input=${v}`);
await fns2.FILLUP("B5", "B3:B4");
await fns2.FILLLEFT("E2", "C2:D2");
eq("FILLUP and FILLLEFT: the source copied back, each formula moved", ["B3", "B4", "C2", "D2"].map((k) => wb2.sheet.input(k)), ["=A3+1", "=A4+1", "=C1*2", "=D1*2"]);
await fns2.AUTOFILL("E1:E2", "E3:E4");
await fns2.AUTOFILL("E1:E2", "F1:G2");
await fns2.AUTOFILL("B3", "B1:B2");
eq("AUTOFILL goes the way the target lies, its source repeated: down, right, up", ["E3", "E4", "F1", "G2", "B1"].map((k) => wb2.sheet.input(k)), ["7", "=E3*2", "7", "=G1*2", "=A1+1"]);
eq("AUTOFILL refuses a target over the source", await failed(() => fns2.AUTOFILL("A1:B2", "B2:C3")), "AUTOFILL: the target must lie beside the source");

eq("SETCOLWIDTH and GETCOLWIDTH, 0 for the grid's own", [await fns2.SETCOLWIDTH("C", 120), await fns2.GETCOLWIDTH(3), await fns2.GETCOLWIDTH("D"), await failed(() => fns2.SETCOLWIDTH("C", -1))],
  ["OK", 120, 0, "-1 is not a width (0 for the grid's)"]);
await cmds2.run("columns.insert at=A");
eq("a width moves with an inserted column", [await fns2.GETCOLWIDTH("D"), wb2.colWidths()], [120, [[3, 120]]]);

for (const [k, v] of [["A10", "region"], ["B10", "sales"], ["A11", "North"], ["B11", "100"], ["A12", "South"], ["B12", "250"]]) await cmds2.run(`cell.set cell=${k} input=${v}`);
eq("GETFILTERCRITERIA: none, then the filter's range, column and criterion", [await fns2.GETFILTERCRITERIA(), (await cmds2.run('data.filter range=A10:B12 column=B criterion=">150"')).ok, JSON.parse(await fns2.GETFILTERCRITERIA() as string)],
  ["", true, { range: "A10:B12", column: "B", criterion: ">150" }]);
await cmds2.run("rows.insert at=1");
eq("the filter moves with an inserted row", [JSON.parse(await fns2.GETFILTERCRITERIA() as string).range, wb2.hidden().rows], ["A11:B13", [11]]);
const saved = JSON.parse(await fns2.EXPORT() as string);
const reopened = new Workbook();
await new Commands(reopened).execute("file.import", { text: JSON.stringify(saved) });
eq("saved, the filter worked out again when opened: its rows not hidden by hand", [saved.view, reopened.hidden().rows, reopened.colWidths()],
  [{ hiddenRows: [], hiddenCols: [], frozenRows: 0, rowHeights: [], colWidths: [[3, 120]], filter: { range: "A11:B13", column: "B", criterion: ">150" } }, [11], [[3, 120]]]);
await new Commands(reopened).run("data.clearFilter");
eq("and cleared", [reopened.hidden().rows, reopened.page(reopened.active)!.filter], [[], null]);
// expect: ok EXPORT, IMPORT, EVALUATE, RECALCULATE and the setup script's three tell their commands
// expect: ok EVALUATE: a formula worked out against the sheet, no cell set; an error says why
// expect: ok RECALCULATE: how many formulas it worked out
// expect: ok SETSETUPSCRIPT keeps it; EXECUTESETUPSCRIPT runs it and works everything out again
// expect: ok a setup script that fails, says why
// expect: ok EXPORT gives the file's JSON; IMPORT opens it, setup script and all
// expect: ok IMPORT of what is not a sheet file
// expect: ok BATCH_SET_CELLS: each set that can be, and a summary
// expect: ok BATCH_EXECUTE: each by any name a script has, SETCELL too; what each gave or why not
// expect: ok FILLUP and FILLLEFT: the source copied back, each formula moved
// expect: ok AUTOFILL goes the way the target lies, its source repeated: down, right, up
// expect: ok AUTOFILL refuses a target over the source
// expect: ok SETCOLWIDTH and GETCOLWIDTH, 0 for the grid's own
// expect: ok a width moves with an inserted column
// expect: ok GETFILTERCRITERIA: none, then the filter's range, column and criterion
// expect: ok the filter moves with an inserted row
// expect: ok saved, the filter worked out again when opened: its rows not hidden by hand
// expect: ok and cleared
