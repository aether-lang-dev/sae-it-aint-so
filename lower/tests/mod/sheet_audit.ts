// Formula auditing. site/sheet/audit.ts: a formula printer (an Expr as
// Excel writes it: functions and references in upper case, parentheses only
// where precedence needs them) and Evaluate Formula's steps, one
// reduction at a time, leftmost innermost first, IF taking only its branch.
// Then the commands: trace precedents and dependents (a level a time, across
// sheets), Show Formulas, Evaluate Formula, the Watch Window.
import { evaluationSteps, print } from "./sheet/audit.ts";
import { parse } from "./sheet/parser.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const p = (f: string) => print(parse(f, () => null));
eq("printed: upper case, no spaces", [p("sum( a1:b2 ) + costs!c3"), p('"a""b" & TRUE'), p("#n/a")], ["SUM(A1:B2)+COSTS!C3", '"a""b"&TRUE', "#N/A"]);
eq("parentheses where precedence needs them, and only there", [p("(1+2)*3"), p("1+(2*3)"), p("1-(2-3)"), p("(1-2)-3"), p("2^(3^2)"), p("-(1+2)"), p("(A1>1)=TRUE")],
  ["(1+2)*3", "1+2*3", "1-(2-3)", "1-2-3", "2^(3^2)", "-(1+2)", "A1>1=TRUE"]);

const cells: Record<string, Value> = { B1: 2, B2: 3, B3: 4, C1: "x", "COSTS!B2": 10 };
const steps = (f: string) => evaluationSteps(f, { get: (k) => cells[k] ?? null });
eq("a reference, then its operator", steps("B1*21"), ["B1*21", "2*21", "42"]);
eq("a range as an array, then the function", steps("SUM(B1:B3)+1"), ["SUM(B1:B3)+1", "SUM({2;3;4})+1", "9+1", "10"]);
eq("left to right, innermost first", steps("(B1+B2)*(B3-1)"), ["(B1+B2)*(B3-1)", "(2+B2)*(B3-1)", "(2+3)*(B3-1)", "5*(B3-1)", "5*(4-1)", "5*3", "15"]);
eq("IF works out its condition, then only the branch it takes", steps('IF(B1>1,"big",1/0)'), ['IF(B1>1,"big",1/0)', 'IF(2>1,"big",1/0)', 'IF(TRUE,"big",1/0)', '"big"']);
eq("text, another sheet, an error", [steps('C1&"!"'), steps("Costs!B2/0")], [['C1&"!"', '"x"&"!"', '"x!"'], ["COSTS!B2/0", "10/0", "#DIV/0!"]]);
eq("a row range has commas", steps("COUNT(B1:C1)"), ["COUNT(B1:C1)", 'COUNT({2,"x"})', "1"]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
for (const line of ["cell.set cell=A1 input=1", 'cell.set cell=A2 input="=A1*2"', 'cell.set cell=A3 input="=A2+A1"', 'cell.set cell=A4 input="=SUM(A2:A3)"']) await cmds.run(line);
eq("trace precedents: the cells a formula reads, one level", [await message("formulas.tracePrecedents cell=A4"), wb.styleOf("A2").includes("background: #dbe9ff"), wb.styleOf("A1")],
  ["A4 reads A2 A3", true, "text-align: end"]);
eq("again: a level further", await message("formulas.tracePrecedents cell=A4"), "A4 reads A2 A3, and they read A1");
eq("trace dependents: what reads a cell", [await message("formulas.traceDependents cell=A1"), wb.styleOf("A3").includes("background: #ffe3c2")], ["A1 is read by A2 A3", true]);
await cmds.run("sheet.add name=Costs");
await cmds.run('cell.set cell=B1 input="=Sheet1!A1+1"');
await cmds.run("sheet.activate name=Sheet1");
eq("on other sheets too", await message("formulas.traceDependents cell=A1"), "A1 is read by A2 A3 Costs!B1, and they are read by A4");
eq("remove arrows", [await message("formulas.removeArrows"), wb.styleOf("A3").includes("background")], ["arrows removed", false]);
eq("nothing to trace", [await message("formulas.tracePrecedents cell=A1"), await message("formulas.traceDependents cell=A4")], ["A1 reads nothing", "A4 is read by nothing"]);
await cmds.run("formulas.removeArrows");
eq("show formulas: the grid shows inputs, then values again", [await message("formulas.showFormulas"), wb.textOf("A2"), wb.textOf("A1"), await message("formulas.showFormulas off=1"), wb.textOf("A2")],
  ["showing formulas", "=A1*2", "1", "showing values", "2"]);
eq("evaluate formula", [await message("formulas.evaluate cell=A4"), (await cmds.run("formulas.evaluate cell=A4")).output],
  ["A4: SUM(A2:A3) → SUM({2;3}) → 5", ["SUM(A2:A3)", "SUM({2;3})", "5"]]);
eq("not a formula; RexxJS's are not stepped", [await message("formulas.evaluate cell=A1"), (await cmds.run("formulas.use language=RexxJS")) && await message("formulas.evaluate cell=A2")],
  ["A1 is not a formula", "Evaluate Formula steps through Excel formulas"]);
await cmds.run("formulas.use language=Excel");
eq("the watch window: cells on any sheet, kept as they change", [await message("formulas.watch cell=A3"), await message("formulas.watch cell=A4"), wb.watches()],
  ["watching Sheet1!A3", "watching Sheet1!A4", [{ sheet: "Sheet1", cell: "A3", input: "=A2+A1", shown: "3" }, { sheet: "Sheet1", cell: "A4", input: "=SUM(A2:A3)", shown: "5" }]]);
await cmds.run("cell.set cell=A1 input=10");
await cmds.run("sheet.activate name=Costs");
eq("from another sheet", [await message("formulas.unwatch cell=Sheet1!A3"), wb.watches().map((w) => `${w.sheet}!${w.cell} ${w.shown}`)], ["stopped watching Sheet1!A3", ["Sheet1!A4 50"]]);
eq("a watch whose sheet goes is gone", [(await cmds.run("sheet.delete name=Sheet1")) && wb.watches()], [[]]);
// expect: ok printed: upper case, no spaces
// expect: ok parentheses where precedence needs them, and only there
// expect: ok a reference, then its operator
// expect: ok a range as an array, then the function
// expect: ok left to right, innermost first
// expect: ok IF works out its condition, then only the branch it takes
// expect: ok text, another sheet, an error
// expect: ok a row range has commas
// expect: ok trace precedents: the cells a formula reads, one level
// expect: ok again: a level further
// expect: ok trace dependents: what reads a cell
// expect: ok on other sheets too
// expect: ok remove arrows
// expect: ok nothing to trace
// expect: ok show formulas: the grid shows inputs, then values again
// expect: ok evaluate formula
// expect: ok not a formula; RexxJS's are not stepped
// expect: ok the watch window: cells on any sheet, kept as they change
// expect: ok from another sheet
// expect: ok a watch whose sheet goes is gone
