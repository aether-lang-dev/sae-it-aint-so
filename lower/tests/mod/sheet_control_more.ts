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

// Sheets renamed, columns moved.
eq("RENAMESHEET, SETSHEETNAME (the active sheet), MOVECOLUMNLEFT and RIGHT tell their commands", [
  await told("RENAMESHEET", ["Costs", "Spend"]), await told("SETSHEETNAME", ["Main"], { "sheet.state": { name: "Sheet1" } }),
  (await told("MOVECOLUMNLEFT", [2]))[1], (await told("MOVECOLUMNRIGHT", ["b"]))[1],
], [
  ["Spend", [["sheet.rename", { name: "Costs", to: "Spend" }]]], ["Main", [["sheet.state", {}], ["sheet.rename", { name: "Sheet1", to: "Main" }]]],
  [["columns.move", { at: "B", way: "left" }]], [["columns.move", { at: "B", way: "right" }]],
]);
const wb3 = new Workbook();
const cmds3 = new Commands(wb3);
const fns3 = controlFunctions((id, params) => cmds3.execute(id, params), {});
for (const [k, v] of [["A1", "1"], ["B1", "2"], ["C1", "=A1*10+B1"], ["C2", "=SUM(A1:B1)"]]) await cmds3.run(`cell.set cell=${k} input=${v}`);
await cmds3.run("cell.comment cell=A1 text=first");
await cmds3.run("columns.width range=A1 width=150");
await fns3.MOVECOLUMNRIGHT("A");
eq("MOVECOLUMNRIGHT: the column and the one beside it swap, what reads them follows, its comment and width go with it",
  [["A1", "B1", "C1", "C2"].map((k) => wb3.sheet.input(k)), show(wb3.sheet.value("C1")), wb3.notes.get("B1").comment, wb3.colWidths()],
  [["2", "1", "=B1*10+A1", "=SUM(A1:B1)"], "12", "first", [[1, 150]]]);
await fns3.MOVECOLUMNLEFT(2);
eq("MOVECOLUMNLEFT puts it back", ["A1", "B1", "C1"].map((k) => wb3.sheet.input(k)), ["1", "2", "=A1*10+B1"]);
eq("not off either end", [await failed(() => fns3.MOVECOLUMNLEFT("A")), await failed(() => fns3.MOVECOLUMNRIGHT(10))],
  ["A is the first column: it cannot move left", "J is the last column: it cannot move right"]);
eq("SETSHEETNAME renames the active sheet, GETSHEETNAME reads it", [await fns3.SETSHEETNAME("Main"), await fns3.GETSHEETNAME(), await fns3.RENAMESHEET("main", "Data"), wb3.sheetNames()],
  ["Main", "Main", "Data", ["Data"]]);

// Table metadata, the sort cycle, auto IDs.
eq("the table and auto-ID functions tell their commands", [
  (await told("SET_TABLE_METADATA", ["Sales", '{"range":"A1:C5","columns":{"region":"A","amount":"C"},"types":{"amount":"number"},"descriptions":{"amount":"in pounds"}}']))[1],
  (await told("GET_TABLE_METADATA", ["Sales"], { "table.get": { name: "Sales", range: "B1:C5", headers: true, columns: ["region", "amount"], types: { amount: "number" }, descriptions: {} } }))[0],
  await told("LIST_TABLES", [], { "table.list": ["Sales A1:C5 (region, B, amount)"] }), await told("SORTTABLEBYCOLUMN", ["Sales", "c"], { "table.sort": "asc" }),
  await told("CONFIGURE_AUTO_ID", [null]), (await told("CONFIGURE_AUTO_ID", ["A", 1000, "ID-"]))[0], await told("FIND_ROW_BY_ID", ["ID-1"], { "ids.find": 3 }),
  await failed(() => told("GET_NEXT_ID", [], { "sheet.state": { autoId: null } })),
], [
  [["table.define", { name: "Sales", range: "A1:C5", headers: "1", columns: "region,B,amount", types: '{"amount":"number"}', descriptions: '{"amount":"in pounds"}' }]],
  '{"range":"B1:C5","columns":{"region":"B","amount":"C"},"hasHeader":true,"types":{"amount":"number"},"descriptions":{}}',
  ['["Sales"]', [["table.list", {}]]], ["asc", [["table.sort", { name: "Sales", column: "C" }]]],
  ["Auto-ID disabled", [["ids.configure", {}]]], 'Auto-ID configured: column=A, nextId=1000, prefix="ID-"', ["3", [["ids.find", { id: "ID-1" }]]],
  "Auto-ID column is not configured for this sheet",
]);

const wb4 = new Workbook();
const cmds4 = new Commands(wb4);
const fns4 = controlFunctions((id, params) => cmds4.execute(id, params), {});
for (const [k, v] of [["A1", "region"], ["B1", "amount"], ["A2", "North"], ["B2", "30"], ["A3", "South"], ["B3", "10"], ["A4", "East"], ["B4", "20"], ["C2", "=B2*2"]]) await cmds4.run(`cell.set cell=${k} input=${v}`);
await cmds4.run("cell.comment cell=A3 text=south");
await fns4.SET_TABLE_METADATA("Sales", { range: "A1:C4", columns: { region: "A", amount: "B", double: "C" }, hasHeader: true, types: { amount: "number" }, descriptions: { double: "twice" } });
eq("SET_TABLE_METADATA then GET_TABLE_METADATA, as the app has it", JSON.parse(await fns4.GET_TABLE_METADATA("sales") as string),
  { range: "A1:C4", columns: { region: "A", amount: "B", double: "C" }, hasHeader: true, types: { amount: "number" }, descriptions: { double: "twice" } });
await cmds4.run("formulas.use language=RexxJS");
await cmds4.run(`cell.set cell=E1 input="=TABLE(""Sales"") |> WHERE(""double > 30"") |> COUNT()"`);
eq("a table with a header row and named columns: TABLE reads the rows below by those names", show(wb4.sheet.value("E1")), "1");
const column = () => ["A2", "A3", "A4"].map((k) => wb4.sheet.input(k));
eq("SORTTABLEBYCOLUMN cycles: ascending, descending, then the rows as they were; formulas and comments go with their rows", [
  await fns4.SORTTABLEBYCOLUMN("Sales", "B"), column(), wb4.sheet.input("C4"), wb4.notes.get("A2").comment,
  await fns4.SORTTABLEBYCOLUMN("Sales", "B"), column(), await fns4.SORTTABLEBYCOLUMN("Sales", "B"), column(), wb4.notes.get("A3").comment, wb4.sheet.input("C2"),
], ["asc", ["South", "East", "North"], "=B4*2", "south", "desc", ["North", "East", "South"], "original", ["North", "South", "East"], "south", "=B2*2"]);
await fns4.SORTTABLEBYCOLUMN("Sales", "A");
eq("another column starts again at ascending; the original order is still the first one", [column(), await fns4.SORTTABLEBYCOLUMN("Sales", "B"), await fns4.SORTTABLEBYCOLUMN("Sales", "b"), await fns4.SORTTABLEBYCOLUMN("Sales", "B"), column()],
  [["East", "North", "South"], "asc", "desc", "original", ["North", "South", "East"]]);
eq("the cycle refuses a column off the table", await failed(() => fns4.SORTTABLEBYCOLUMN("Sales", "D")), "D is not a column of Sales");

eq("auto IDs: CONFIGURE_AUTO_ID, then each row inserted gets the next", [await fns4.CONFIGURE_AUTO_ID("D", 1001, "ID-"), await fns4.GET_NEXT_ID(),
  (await cmds4.run("rows.insert at=3 count=2")).ok, wb4.sheet.input("D3"), wb4.sheet.input("D4"), await fns4.GET_NEXT_ID()],
  ['Auto-ID configured: column=D, nextId=1001, prefix="ID-"', "ID-1001", true, "ID-1001", "ID-1002", "ID-1003"]);
eq("FIND_ROW_BY_ID and UPDATE_ROW_BY_ID", [await fns4.FIND_ROW_BY_ID("ID-1002"), await fns4.FIND_ROW_BY_ID("nope"),
  await fns4.UPDATE_ROW_BY_ID("ID-1002", '[{"column":"A","value":"West"},{"column":"B","value":"5"}]'), wb4.sheet.input("A4"), wb4.sheet.input("B4"),
  await failed(() => fns4.UPDATE_ROW_BY_ID("nope", "[]"))], ["4", "", "4", "West", "5", "Row with ID nope not found"]);
const file4 = JSON.parse(await fns4.EXPORT() as string);
const wb5 = new Workbook();
await new Commands(wb5).execute("file.import", { text: JSON.stringify(file4) });
eq("saved: a table's types and descriptions, the auto-ID column and the next ID", [file4.tables[0].types, file4.tables[0].descriptions, file4.autoId, wb5.page(wb5.active)!.autoId],
  [{ amount: "number" }, { double: "twice" }, { column: "D", next: 1003, prefix: "ID-" }, { column: 3, next: 1003, prefix: "ID-" }]);
eq("DELETE_TABLE_METADATA, LIST_TABLES, and auto IDs off", [await fns4.DELETE_TABLE_METADATA("Sales"), await fns4.LIST_TABLES(), await fns4.CONFIGURE_AUTO_ID(""), await failed(() => fns4.FIND_ROW_BY_ID("ID-1001"))],
  ["Table metadata deleted for 'Sales'", "[]", "Auto-ID disabled", "no auto-ID column on this sheet"]);

// Cell editors.
eq("SETCELLEDITOR, GETCELLEDITOR and REMOVECELLEDITOR tell their commands", [
  await told("SETCELLEDITOR", ["A1", "dropdown", '{"options":["Red","Green"]}']), await told("SETCELLEDITOR", ["A2", "date", { format: "YYYY-MM-DD" }]),
  (await told("GETCELLEDITOR", ["A1"], { "cell.about": { editor: { type: "checkbox", config: {} } } }))[0], (await told("GETCELLEDITOR", ["A1"], { "cell.about": { editor: null } }))[0],
  await told("REMOVECELLEDITOR", ["A1"], { "cell.about": { editor: null } }),
], [
  ["A1", [["cell.editor", { cell: "A1", kind: "dropdown", options: "Red,Green" }]]], ["A2", [["cell.editor", { cell: "A2", kind: "date", format: "YYYY-MM-DD" }]]],
  '{"type":"checkbox","config":{}}', "", ["A1", [["cell.about", { cell: "A1" }]]],
]);
const wb6 = new Workbook();
const fns6 = controlFunctions((id, params) => new Commands(wb6).execute(id, params), {});
await fns6.SETCELLEDITOR("B1", "checkbox");
eq("through a workbook: set, read, held to, removed", [await fns6.GETCELLEDITOR("B1"), await failed(() => fns6.SETCELLS("B1:B1", ["maybe"])), await fns6.REMOVECELLEDITOR("B1"), await fns6.GETCELLEDITOR("B1"),
  await failed(() => fns6.SETCELLEDITOR("B1", "dropdown", "{}"))],
  ['{"type":"checkbox","config":{}}', "B1 is a checkbox: TRUE or FALSE", "B1", "", "a dropdown needs options"]);
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
// expect: ok RENAMESHEET, SETSHEETNAME (the active sheet), MOVECOLUMNLEFT and RIGHT tell their commands
// expect: ok MOVECOLUMNRIGHT: the column and the one beside it swap, what reads them follows, its comment and width go with it
// expect: ok MOVECOLUMNLEFT puts it back
// expect: ok not off either end
// expect: ok SETSHEETNAME renames the active sheet, GETSHEETNAME reads it
// expect: ok the table and auto-ID functions tell their commands
// expect: ok SET_TABLE_METADATA then GET_TABLE_METADATA, as the app has it
// expect: ok a table with a header row and named columns: TABLE reads the rows below by those names
// expect: ok SORTTABLEBYCOLUMN cycles: ascending, descending, then the rows as they were; formulas and comments go with their rows
// expect: ok another column starts again at ascending; the original order is still the first one
// expect: ok the cycle refuses a column off the table
// expect: ok auto IDs: CONFIGURE_AUTO_ID, then each row inserted gets the next
// expect: ok FIND_ROW_BY_ID and UPDATE_ROW_BY_ID
// expect: ok saved: a table's types and descriptions, the auto-ID column and the next ID
// expect: ok DELETE_TABLE_METADATA, LIST_TABLES, and auto IDs off
// expect: ok SETCELLEDITOR, GETCELLEDITOR and REMOVECELLEDITOR tell their commands
// expect: ok through a workbook: set, read, held to, removed
