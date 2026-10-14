// site/sheet/functions.ts and the Name Manager, To do 7: functions given a
// range where they take one value worked out a cell at a time; named
// LAMBDAs (and so recursion); TAKE, DROP, CHOOSEROWS, CHOOSECOLS, VSTACK,
// HSTACK, TOCOL, TOROW, WRAPROWS, WRAPCOLS, EXPAND; TEXT, TEXTBEFORE,
// TEXTAFTER, TEXTSPLIT.
import { evaluate } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { CellError, isArray } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { show } from "./sheet/format.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { eq } from "./lib/check.ts";
import { movedBy } from "./sheet/shift.ts";
import { EXCEL } from "./sheet/excel.ts";
import { evaluationSteps } from "./sheet/audit.ts";

// A1:C3 is 1 to 9 by rows; D1:D3 is text; F1:F2 two delimiters.
const cells = new Map<string, Value>([
  ["A1", 1], ["B1", 2], ["C1", 3], ["A2", 4], ["B2", 5], ["C2", 6], ["A3", 7], ["B3", 8], ["C3", 9],
  ["D1", "apple pie"], ["D2", "Banana-Split"], ["D3", "a,b;c,d,e"],
  ["E1", new CellError("#DIV/0!", "divide by zero")], ["F1", ","], ["F2", ";"],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
// An array as its rows, each cell as shown; one value as shown.
const ev = (src: string): unknown => {
  const v = evaluate(parse(src), env);
  if (!isArray(v)) return show(v);
  return Array.from({ length: v.rows }, (_, i) => v.values.slice(i * v.cols, (i + 1) * v.cols).map((x) => show(x)));
};

eq("functions over a range: each cell", [ev("UPPER(D1:D2)"), ev("LEN(D1:D3)"), ev("IFERROR(1/(A1:C1-2), \"none\")")],
  [[["APPLE PIE"], ["BANANA-SPLIT"]], [["9"], ["12"], ["9"]], [["-1", "none", "1"]]]);
eq("a row and a column paired as a grid", ev("A1:C1 * 0 + ROUND(A1:A3 / B1:B1, 0)"), [["1", "1", "1"], ["2", "2", "2"], ["4", "4", "4"]]);
eq("functions that take a range are not lifted", [ev("SUM(A1:C3)"), ev("INDEX(A1:C3, 2, 3)")], ["45", "6"]);

eq("TAKE", [ev("TAKE(A1:C3, 2)"), ev("TAKE(A1:C3, -1)"), ev("TAKE(A1:C3, , -1)"), ev("TAKE(A1:C3, 1, 2)")],
  [[["1", "2", "3"], ["4", "5", "6"]], [["7", "8", "9"]], [["3"], ["6"], ["9"]], [["1", "2"]]]);
eq("DROP", [ev("DROP(A1:C3, 2)"), ev("DROP(A1:C3, -2, 1)"), ev("DROP(A1:C3, 3)")], [[["7", "8", "9"]], [["2", "3"]], "#CALC!"]);
eq("CHOOSEROWS and CHOOSECOLS, from the end when negative", [ev("CHOOSEROWS(A1:C3, 3, 1)"), ev("CHOOSECOLS(A1:C3, -1, 1)"), ev("CHOOSECOLS(A1:C3, 4)")],
  [[["7", "8", "9"], ["1", "2", "3"]], [["3", "1"], ["6", "4"], ["9", "7"]], "#VALUE!"]);
eq("VSTACK and HSTACK, #N/A where one runs short", [ev("VSTACK(A1:B1, C1:C2)"), ev("HSTACK(A1:A2, C1)")],
  [[["1", "2"], ["3", "#N/A"], ["6", "#N/A"]], [["1", "3"], ["4", "#N/A"]]]);
eq("TOCOL and TOROW, by column, skipping errors", [ev("TOROW(A1:B2)"), ev("TOCOL(A1:B2, 0, 1)"), ev("TOROW(D1:E1, 2)")],
  [[["1", "2", "4", "5"]], [["1"], ["4"], ["2"], ["5"]], "apple pie"]);
eq("WRAPROWS, WRAPCOLS and EXPAND, padded", [ev("WRAPROWS(TOROW(A1:B2), 3)"), ev("WRAPCOLS(TOCOL(A1:A3), 2, 0)"), ev("EXPAND(A1, 2, 2, \"-\")")],
  [[["1", "2", "4"], ["5", "#N/A", "#N/A"]], [["1", "7"], ["4", "0"]], [["1", "-"], ["-", "-"]]]);

eq("TEXT in a number format", [ev("TEXT(1234.5, \"#,##0.00\")"), ev("TEXT(0.256, \"0.0%\")"), ev("TEXT(\"7\", \"000\")"), ev("TEXT(\"x\", \"0\")")],
  ["1,234.50", "25.6%", "007", "x"]);
eq("TEXTBEFORE and TEXTAFTER", [ev("TEXTBEFORE(D1, \" \")"), ev("TEXTAFTER(D2, \"-\")"), ev("TEXTAFTER(D3, \",\", -1)"), ev("TEXTBEFORE(D3, \",\", 2)")],
  ["apple", "Split", "e", "a,b;c"]);
eq("any of several delimiters, any case, the end as one, if not found", [ev("TEXTBEFORE(D3, F1:F2, 2)"), ev("TEXTAFTER(D2, \"banana\", 1, 1)"), ev("TEXTBEFORE(D1, \"z\", 1, 0, 1)"), ev("TEXTAFTER(D1, \"z\", 1, 0, 0, \"-\")"), ev("TEXTAFTER(D1, \"z\")")],
  ["a,b", "-Split", "apple pie", "-", "#N/A"]);
eq("TEXTSPLIT into columns and rows, padded", [ev("TEXTSPLIT(D3, \",\", \";\")"), ev("TEXTSPLIT(D1, \" \")"), ev("TEXTSPLIT(\"a,,b\", \",\", , 1)")],
  [[["a", "b", "#N/A"], ["c", "d", "e"]], [["apple", "pie"]], [["a", "b"]]]);
eq("TEXTSPLIT over a range: #CALC! where a cell's is an array", ev("TEXTSPLIT(D1:D2, \" \")"), [["#CALC!"], ["Banana-Split"]]);

eq("array constants: rows split by ';', negatives, text, TRUE, errors", [ev("{1,2;3,4}"), ev("{-1.5,\"#N/A\",TRUE,#N/A}"), ev("SUM({1,2;3,4}*10)"), ev("TAKE({1,2,3}, , -1)")],
  [[["1", "2"], ["3", "4"]], [["-1.5", "#N/A", "TRUE", "#N/A"]], "100", "3"]);
eq("and what they lift", [ev("UPPER({\"a\",\"b\"})"), ev("TEXTBEFORE(D3, {\",\";\";\"}, 2)"), ev("ISTEXT({\"#N/A\",#N/A})")],
  [[["A", "B"]], "a,b", [["TRUE", "FALSE"]]]);
eq("a copy moves the references round a constant, not the constant; Evaluate Formula prints it",
  [movedBy(EXCEL, "=SUM({1,2;3,4}*A1)", { cols: 1, rows: 1 }), evaluationSteps("SUM({1,2}*A1)", env)],
  ["=SUM({1,2;3,4}*B2)", ["SUM({1,2}*A1)", "SUM({1,2}*1)", "SUM({1,2})", "3"]]);
const broken = (src: string) => { try { parse(src); return "parsed"; } catch (e) { return (e as Error).message; } };
eq("refusals: a reference, a ragged row, an unclosed brace", [broken("{A1,2}"), broken("{1,2;3}"), broken("{1,2")],
  ["an array constant holds numbers, text, TRUE, FALSE or errors, not 'A1'", "an array constant's rows differ in length", "expected ',', ';' or '}' but found the end"]);

// Named LAMBDAs, through the Name Manager.
const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
const value = (k: string) => show(wb.sheet.value(k));
eq("a name for a LAMBDA", await message('names.define name=DOUBLE formula="=LAMBDA(x, x*2)"'), "DOUBLE is =LAMBDA(x, x*2)");
await cmds.run("cell.set cell=A1 input=21");
await cmds.run('cell.set cell=B1 input="=DOUBLE(A1)"');
await cmds.run('cell.set cell=B2 input="=MAP(SEQUENCE(3), DOUBLE)"');
eq("called as a function, and passed as one", [value("B1"), value("B2"), value("B3"), value("B4")], ["42", "2", "4", "6"]);
await cmds.run('names.define name=DOUBLE formula="=LAMBDA(x, x*3)"');
eq("redefined, what calls it is worked out again", value("B1"), "63");
await cmds.run('names.define name=FACTORIAL formula="=LAMBDA(n, IF(n<2, 1, n*FACTORIAL(n-1)))"');
await cmds.run('cell.set cell=C1 input="=FACTORIAL(10)"');
await cmds.run('names.define name=FOREVER formula="=LAMBDA(n, FOREVER(n+1))"');
await cmds.run('cell.set cell=C2 input="=FOREVER(1)"');
eq("one can call itself, so far", [value("C1"), value("C2")], ["3628800", "#NUM!"]);
eq("its name, as a value, is a LAMBDA", [await message('cell.set cell=C3 input="=DOUBLE"')], ["C3 = #CALC!"]);
await cmds.run('names.define name=SCALED formula="=LAMBDA(x, x*A1)"');
await cmds.run('cell.set cell=C4 input="=SCALED(2)"');
await cmds.run("cell.set cell=A1 input=5");
eq("what its body reads, the cell that calls it reads", value("C4"), "10");
eq("the Name Manager lists both kinds", await message("names.list"),
  "DOUBLE =LAMBDA(x, x*3), FACTORIAL =LAMBDA(n, IF(n<2, 1, n*FACTORIAL(n-1))), FOREVER =LAMBDA(n, FOREVER(n+1)), SCALED =LAMBDA(x, x*A1)");
eq("refusals: no '=', a function's name, a formula that does not parse, neither or both", [
  await message('names.define name=X formula="LAMBDA(x, x)"'), await message('names.define name=SUM formula="=LAMBDA(x, x)"'),
  await message('names.define name=X formula="=LAMBDA(x, "'), await message("names.define name=X"), await message('names.define name=X range=A1 formula="=1"'),
], ["a named formula starts with =: LAMBDA(x, x)", "SUM is a function already", "parse error at 12: expected a value but found the end",
  "names.define needs a range or a formula", "names.define needs a range or a formula"]);
await cmds.run("names.delete name=DOUBLE");
eq("deleted, what called it is #NAME?", value("B1"), "#NAME?");
await cmds.run("edit.undo");
eq("and one undo brings it back", value("B1"), "15");
await cmds.run("names.define name=DOUBLE range=A1");
eq("a name is a range's or a formula's, not both", [wb.sheet.formula("DOUBLE"), value("B1")], [null, "#NAME?"]);
await cmds.run("edit.undo");
const saved = (await cmds.run("file.export")).output as string;
await cmds.run("file.new");
await cmds.run(`file.import text="${saved.replace(/"/g, '""')}"`);
eq("saved and opened with the file", [wb.sheet.formula("FACTORIAL"), value("C1")], ["LAMBDA(n, IF(n<2, 1, n*FACTORIAL(n-1)))", "3628800"]);

// expect: ok functions over a range: each cell
// expect: ok a row and a column paired as a grid
// expect: ok functions that take a range are not lifted
// expect: ok TAKE
// expect: ok DROP
// expect: ok CHOOSEROWS and CHOOSECOLS, from the end when negative
// expect: ok VSTACK and HSTACK, #N/A where one runs short
// expect: ok TOCOL and TOROW, by column, skipping errors
// expect: ok WRAPROWS, WRAPCOLS and EXPAND, padded
// expect: ok TEXT in a number format
// expect: ok TEXTBEFORE and TEXTAFTER
// expect: ok any of several delimiters, any case, the end as one, if not found
// expect: ok TEXTSPLIT into columns and rows, padded
// expect: ok TEXTSPLIT over a range: #CALC! where a cell's is an array
// expect: ok array constants: rows split by ';', negatives, text, TRUE, errors
// expect: ok and what they lift
// expect: ok a copy moves the references round a constant, not the constant; Evaluate Formula prints it
// expect: ok refusals: a reference, a ragged row, an unclosed brace
// expect: ok a name for a LAMBDA
// expect: ok called as a function, and passed as one
// expect: ok redefined, what calls it is worked out again
// expect: ok one can call itself, so far
// expect: ok its name, as a value, is a LAMBDA
// expect: ok what its body reads, the cell that calls it reads
// expect: ok the Name Manager lists both kinds
// expect: ok refusals: no '=', a function's name, a formula that does not parse, neither or both
// expect: ok deleted, what called it is #NAME?
// expect: ok and one undo brings it back
// expect: ok a name is a range's or a formula's, not both
// expect: ok saved and opened with the file
