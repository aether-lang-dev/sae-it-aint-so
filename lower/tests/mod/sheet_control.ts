// The Tauri app's control functions by name (site/sheet/control.ts): first
// each against a stubbed exec (what command it tells, with what, and what it
// makes of the answer), then in scripts through a Workbook, and last the
// app's own ARexx-style demonstration script, unchanged but for its ADDRESS.
import { CONTROL, MISSING, controlFunctions } from "./sheet/control.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { ADDRESS_DEMO } from "./lib/app_address_demo.ts";
import { eq } from "./lib/check.ts";
import { failed, stub, told as toldBy } from "./lib/controlstub.ts";

const told = (name: string, args: unknown[], answers: Record<string, unknown> = {}) => toldBy(CONTROL, name, args, answers);

eq("a setter tells its command, and gives what the app's gives", [
  await told("SETFORMAT", ["A1", "bold"]), await told("CLEARCELL", ["B2"]), await told("ADDSHEET", ["Costs"]),
], [
  ["bold", [["cell.format", { cell: "A1", format: "bold" }]]], ["", [["range.clear", { range: "B2" }]]], ["Costs", [["sheet.add", { name: "Costs" }]]],
]);
eq("rows from 1, columns by letter or number", [
  (await told("INSERTROW", [2]))[1], (await told("INSERTCOLUMN", [2]))[1], (await told("DELETECOLUMN", ["c"]))[1], (await told("HIDECOLUMN", ["5"]))[1], (await told("HIDEROW", [4]))[1],
], [
  [["rows.insert", { at: "2" }]], [["columns.insert", { at: "B" }]], [["columns.delete", { at: "C" }]], [["columns.hide", { range: "E1" }]], [["rows.hide", { range: "A4" }]],
]);
eq("the app's argument shapes as the commands' own", [
  (await told("FILLDOWN", ["A1", "A2:A5"]))[1], (await told("FILLRIGHT", ["A1:A2", "B1:D2"]))[1], (await told("SORTRANGE", ["A1:C10", 2, 0]))[1], (await told("SORTRANGE", ["A1:C10", "a"]))[1],
  (await told("SETWRAPTEXT", ["A1", 0]))[1], (await told("FIND", ["x", 1, 0, "1"], { "edit.find": ["A1", "B2"] })),
  (await told("SETCELLVALIDATION", ["A1", "number", 0, 100]))[1], (await told("SETCELLVALIDATION", ["A1", "list", "Red,Green"]))[1],
  (await told("FREEZEPANES", [2, 0]))[1], (await told("DEFINETABLE", ["T", "A1:B3"], { "table.get": { name: "T", range: "A1:B3", columns: ["x", "y"] } })),
], [
  [["edit.fillDown", { range: "A1:A5", source: "1" }]], [["edit.fillRight", { range: "A1:D2", source: "1" }]], [["data.sortDescending", { range: "A1:C10", by: "B" }]], [["data.sortAscending", { range: "A1:C10", by: "A" }]],
  [["format.wrap", { range: "A1", off: "1" }]], [{ 0: 2, 1: "A1", 2: "B2" }, [["edit.find", { text: "x", matchCase: "1", inFormulas: "1" }]]],
  [["validation.set", { range: "A1", kind: "decimal", min: "0", max: "100" }]], [["validation.set", { range: "A1", kind: "list", values: "Red,Green" }]],
  [["view.freezeRows", { count: "2" }]], ['{"name":"T","range":"A1:B3","columns":["x","y"]}', [["table.define", { name: "T", range: "A1:B3", headers: "1" }], ["table.get", { name: "T" }]]],
]);

const cell = { value: 300, input: "=A1+A2", format: "number:0.00", comment: "sum", wrap: 1, merged: "A1:B1", validation: null };
const sheet = { name: "Sheet1", sheets: ["Sheet1", "Costs"], hiddenRows: [3], hiddenCols: ["E"], frozenRows: 1, rowHeights: [[2, 40]], canUndo: 0, canRedo: 1 };
const reads = async (name: string, ...args: unknown[]) => (await told(name, args, { "cell.about": cell, "sheet.state": sheet }))[0];
eq("a getter reads cell.about or sheet.state", [
  await reads("GETEXPRESSION", "A3"), await reads("GETFORMAT", "A3"), await reads("GETCOMMENT", "A3"), await reads("GETWRAPTEXT", "A3"), await reads("GETMERGEDRANGE", "A3"), await reads("ISCELLMERGED", "A3"),
  await reads("ISROWHIDDEN", 3), await reads("ISROWVISIBLE", 3), await reads("ISCOLUMNHIDDEN", 5), await reads("GETROWHEIGHT", 2), await reads("GETROWHEIGHT", 9),
  await reads("GETFROZENPANES"), await reads("GETSHEETNAMES"), await reads("GETACTIVESHEET"), await reads("CANUNDO"), await reads("CANREDO"),
], ["A1+A2", "number:0.00", "sum", 1, "A1:B1", "1", 1, "0", 1, 40, 0, { ROWS: 1, COLUMNS: 0 }, { 0: 2, 1: "Sheet1", 2: "Costs" }, "Sheet1", 0, 1]);
eq("UNDO and REDO give 1 when there was one to take, and only then tell edit.undo", [await told("UNDO", [], { "sheet.state": sheet }), await told("REDO", [], { "sheet.state": sheet })],
  [[0, [["sheet.state", {}]]], [1, [["sheet.state", {}], ["edit.redo", {}]]]]);
eq("names and tables from their lists", [
  (await told("GETNAMEDRANGE", ["rate"], { "names.list": ["RATE B1", "COSTS A1:A9"] }))[0], (await told("GETALLNAMEDRANGES", [], { "names.list": ["RATE B1"] }))[0],
  (await told("LISTTABLES", [], { "table.list": ["Sales A1:D5 (region)", "T B1:B2 ()"] }))[0], (await told("GETTABLE", ["none"], { "table.list": [] }))[0],
], ["B1", { 0: 1, "1.NAME": "RATE", "1.RANGE": "B1" }, { 0: 2, 1: "Sales", 2: "T" }, ""]);
eq("references worked out without the sheet", [await told("GETROW", ["C5"]), await told("GETCOL", ["C5"]), await told("GETCOLNAME", ["c5"]), await told("MAKECELLREF", [3, 5]), await told("MAKECELLREF", ["c", "5"])],
  [[5, []], [3, []], ["C", []], ["C5", []], ["C5", []]]);
eq("refusals: a bad argument, a refused command, what demo 18 cannot do", [
  await failed(() => told("INSERTROW", [0])), await failed(() => told("HIDECOLUMN", ["AB"])), await failed(() => CONTROL.MERGECELLS(stub({}, ["cells.merge"]).exec, "A1:B2")),
  await failed(() => told("FREEZEPANES", [1, 2])), await failed(() => told("SETCELLVALIDATION", ["A1", "text", 1, 5, "^a"])),
], [
  "INSERTROW needs a row number (e.g. 2)", 'HIDECOLUMN needs a column, a letter or a number (e.g. "B" or 2)', "cells.merge refused",
  "FREEZEPANES: demo 18 freezes rows only", "SETCELLVALIDATION: demo 18 has no pattern rule yet",
]);

// The app's LISTCOMMANDS, as it lists them: each is here, missing, or one
// a script has of its own.
const APP = ["SETCELL", "GETCELL", "GETEXPRESSION", "CLEARCELL", "SUM_RANGE", "AVERAGE_RANGE", "COUNT_RANGE", "MIN_RANGE", "MAX_RANGE", "SUMIF_RANGE", "COUNTIF_RANGE",
  "SPREADSHEET_VERSION", "SETFORMAT", "GETFORMAT", "SETCOMMENT", "GETCOMMENT", "GETROW", "GETCOL", "GETCOLNAME", "MAKECELLREF", "GETCELLS", "SETCELLS", "CLEAR", "EXPORT",
  "IMPORT", "GETSHEETNAME", "SETSHEETNAME", "EVALUATE", "RECALCULATE", "GETSETUPSCRIPT", "SETSETUPSCRIPT", "EXECUTESETUPSCRIPT", "INSERTROW", "DELETEROW", "INSERTCOLUMN",
  "DELETECOLUMN", "FILLDOWN", "FILLRIGHT", "FILLUP", "FILLLEFT", "AUTOFILL", "SORTRANGE", "FIND", "REPLACE", "SETWRAPTEXT", "GETWRAPTEXT", "HIDEROW", "UNHIDEROW", "HIDECOLUMN",
  "UNHIDECOLUMN", "ISROWHIDDEN", "ISCOLUMNHIDDEN", "SETCOLWIDTH", "GETCOLWIDTH", "SETROWHEIGHT", "GETROWHEIGHT", "DEFINENAMEDRANGE", "DELETENAMEDRANGE", "GETNAMEDRANGE",
  "GETALLNAMEDRANGES", "FREEZEPANES", "UNFREEZEPANES", "GETFROZENPANES", "SETCELLVALIDATION", "CLEARCELLVALIDATION", "VALIDATECELL", "UNDO", "REDO", "CANUNDO", "CANREDO",
  "ADDSHEET", "DELETESHEET", "RENAMESHEET", "SETACTIVESHEET", "GETACTIVESHEET", "GETSHEETNAMES", "APPLYROWFILTER", "CLEARROWFILTER", "GETFILTERCRITERIA", "ISROWVISIBLE",
  "MOVECOLUMNLEFT", "MOVECOLUMNRIGHT", "MERGECELLS", "UNMERGECELLS", "GETMERGEDRANGE", "ISCELLMERGED", "SETCELLEDITOR", "GETCELLEDITOR", "REMOVECELLEDITOR", "CREATEPIVOT",
  "UPDATEPIVOT", "DELETEPIVOT", "GETPIVOT", "LISTPIVOTS", "PIVOTCONFIG", "DEFINETABLE", "DELETETABLE", "GETTABLE", "LISTTABLES", "SORTTABLEBYCOLUMN", "LISTCOMMANDS"];
const OWN = ["SETCELL", "GETCELL", "SUM_RANGE", "AVERAGE_RANGE", "COUNT_RANGE", "MIN_RANGE", "MAX_RANGE", "SUMIF_RANGE", "COUNTIF_RANGE"];
const fns = controlFunctions(stub().exec, Object.fromEntries(OWN.map((n) => [n, () => n])));
eq("every name the app lists is here, missing, or a script's own; none both", [APP.filter((n) => !(n in fns) && !OWN.includes(n)), Object.keys(CONTROL).filter((n) => n in MISSING)], [[], []]);
const listed = fns.LISTCOMMANDS() as Record<string, unknown>;
const names = Object.entries(listed).filter(([k]) => k !== "0").map(([, n]) => n as string);
eq("LISTCOMMANDS: a stem of what a script may call, the app's list among them; LISTCOMMANDS('missing'), what it may not yet and why", [
  APP.filter((n) => !(n in MISSING) && !names.includes(n)), names.filter((n) => !(n in fns) && !OWN.includes(n)), listed[0] === names.length,
  (fns.LISTCOMMANDS("missing") as Record<string, unknown>)[0], await failed(() => fns.CREATEPIVOT("p", "{}")),
], [[], [], true, Object.keys(MISSING).length, "CREATEPIVOT is not in demo 18 yet: it needs pivot tables"]);

// Through a workbook.
const wb = new Workbook();
const cmds = new Commands(wb);
const said: string[] = [];
const script = async (text: string) => {
  said.length = 0;
  return (await cmds.script(text, (line) => said.push(line))).message;
};
eq("cell.about and sheet.state, the getters' commands", [(await cmds.run("cell.comment cell=B2 text=hi")) && (await cmds.run("cell.about cell=B2")).output, (await cmds.run("sheet.state")).output],
  [{ cell: "B2", value: "", input: "", format: "", comment: "hi", wrap: 0, merged: "", validation: null },
    { name: "Sheet1", sheets: ["Sheet1"], hiddenRows: [], hiddenCols: [], frozenRows: 0, rowHeights: [], colWidths: [], filter: null, canUndo: 0, canRedo: 0, autoId: null }]);
eq("a script calls them by the app's names", [await script(`LET r = SETCELL("A1", 10); LET r = SETCELL("A2", 20); LET r = INSERTROW(2); LET r = HIDEROW(2)
SAY GETCELL("A3") ISROWHIDDEN(2) ISROWHIDDEN(3); LET r = UNDO(); SAY CANUNDO() CANREDO(); LET n = GETSHEETNAMES(); SAY n.0 n.1`), said, wb.sheet.input("A3")],
  ["ran", ["20 1 0", "1 1", "1 Sheet1"], ""]);
eq("a missing one stops the script, saying what it needs", await script(`LET r = CREATEPIVOT("p", "{}")`), "CREATEPIVOT is not in demo 18 yet: it needs pivot tables");
eq("ADDRESS SPREADSHEET: each string REXX, RC and RESULT set; a failure RC 1", [await script(`ADDRESS SPREADSHEET
'SETCELL("C1", "=A1*3")'
SAY RC RESULT
'GETCELL("C1")'
SAY RC RESULT
'NOSUCH("C1")'
SAY RC`), said], ["ran", ["0 =A1*3", "0 30", "1"]]);

// The app's sheets are always RexxJS formulas (B3 is =B2 |> LOWER).
const demo = new Workbook();
const lines: string[] = [];
await new Commands(demo).run("formulas.use language=RexxJS");
const outcome = await new Commands(demo).script(ADDRESS_DEMO, (line) => lines.push(line));
eq("the app's ARexx-style demonstration runs unchanged, every command RC 0", [outcome.message, lines.filter((l) => l.includes("✗")), lines.filter((l) => l.startsWith("  ✓ Got"))],
  ["ran", [], ["  ✓ Got A1 = 100", "  ✓ Got A3 = 300 (calculated from =A1+A2)", "  ✓ Got B3 = hello from rexx! (should be 'hello from rexx!')"]]);
eq("and leaves the sheet as it says it does", ["A1", "A2", "A3", "B1", "B2", "B3", "D1", "D2", "D3", "E2", "F1"].map((k) => show(demo.sheet.value(k))),
  ["100", "200", "300", "Hello from REXX!", "HELLO FROM REXX!", "hello from rexx!", "123.456789", "1234.56", "0.125", "Center", "999.99"]);
eq("its formats as the grid draws them", ["D1", "D2", "D3", "F1"].map((k) => demo.textOf(k)), ["123.46", "$1,234.56", "12.5%", "$999.99"]);
// expect: ok a setter tells its command, and gives what the app's gives
// expect: ok rows from 1, columns by letter or number
// expect: ok the app's argument shapes as the commands' own
// expect: ok a getter reads cell.about or sheet.state
// expect: ok UNDO and REDO give 1 when there was one to take, and only then tell edit.undo
// expect: ok names and tables from their lists
// expect: ok references worked out without the sheet
// expect: ok refusals: a bad argument, a refused command, what demo 18 cannot do
// expect: ok every name the app lists is here, missing, or a script's own; none both
// expect: ok LISTCOMMANDS: a stem of what a script may call, the app's list among them; LISTCOMMANDS('missing'), what it may not yet and why
// expect: ok cell.about and sheet.state, the getters' commands
// expect: ok a script calls them by the app's names
// expect: ok a missing one stops the script, saying what it needs
// expect: ok ADDRESS SPREADSHEET: each string REXX, RC and RESULT set; a failure RC 1
// expect: ok the app's ARexx-style demonstration runs unchanged, every command RC 0
// expect: ok and leaves the sheet as it says it does
// expect: ok its formats as the grid draws them
