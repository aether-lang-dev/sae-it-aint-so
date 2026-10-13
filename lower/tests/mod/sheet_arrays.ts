// Dynamic arrays, as Excel 365 has them. A formula may come to an array: a
// range, arithmetic over ranges cell by cell (broadcast across a row or a
// column, #N/A where one runs out), IF over an array, SEQUENCE, FILTER,
// SORT, SORTBY, UNIQUE, TRANSPOSE, an XLOOKUP that returns a row, and MAP,
// REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY with a LAMBDA. In a sheet it spills
// into the cells below and to the right: they show its values and are read
// as any cell, A1# is all of it, and anything in the way (or the sheet's
// edge) makes it #SPILL! until it is cleared.
import { evaluate } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { show } from "./sheet/format.ts";
import { CellError, isArray } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { eq } from "./lib/check.ts";

const cells = new Map<string, Value>([
  ["A1", 1], ["A2", 2], ["A3", 3], ["B1", 10], ["C1", 20],
  ["D1", "a"], ["D2", "b"], ["D3", "c"], ["D4", "d"], ["E1", 1], ["E2", 3], ["E3", 2], ["E4", 5],
  ["F1", "x"], ["F2", "Y"], ["F3", "y"], ["F4", "z"], ["F5", "x"], ["G1", 1], ["H1", 2], ["G2", 3], ["H2", 4],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const text = (v: Value) => (v instanceof CellError ? v.code : show(v));
const ev = (...srcs: string[]): string[] => srcs.map((src) => {
  const v = evaluate(parse(src, () => null), env);
  if (isArray(v)) return Array.from({ length: v.rows }, (_, i) => v.values.slice(i * v.cols, (i + 1) * v.cols).map(text).join(",")).join(";");
  return v instanceof CellError ? `${v.code} ${v.why}` : show(v);
});

eq("a range is an array; one of one cell its value", ev("A1:A3", "A1:A1"), ["1;2;3", "1"]);
eq("arithmetic cell by cell, broadcast, #N/A where one runs out", ev("A1:A3*2", "A1:A3+B1:C1", "A1:A2+A1:A3", "-A1:A2", 'A1:A2&"!"'),
  ["2;4;6", "11,21;12,22;13,23", "2;4;#N/A", "-1;-2", "1!;2!"]);
eq("IF over an array; a function of an array", ev('IF(A1:A3>1,"big","small")', "SUM(A1:A3*2)", "LET(xs, SEQUENCE(3), SUM(xs))"), ["small;big;big", "12", "6"]);
eq("SEQUENCE", ev("SEQUENCE(3)", "SEQUENCE(2,3,10,5)", "SEQUENCE(0)"), ["1;2;3", "10,15,20;25,30,35", "#CALC! SEQUENCE of no rows"]);
eq("FILTER", ev("FILTER(D1:E4,E1:E4>2)", 'FILTER(D1:D4,E1:E4>9,"none")', "FILTER(D1:D4,E1:E4>9)", "FILTER(D1:E4,E1:E2>2)"),
  ["b,3;d,5", "none", "#CALC! FILTER found nothing", "#VALUE! FILTER's include is not the array's height or width"]);
eq("SORT and SORTBY", ev("SORT(E1:E4)", "SORT(D1:E4,2,-1)", "SORTBY(D1:D4,E1:E4)", "SORTBY(D1:D4,E1:E4,-1)"), ["1;2;3;5", "d,5;b,3;c,2;a,1", "a;c;b;d", "d;b;c;a"]);
eq("UNIQUE, any case; or what is there exactly once", ev("UNIQUE(F1:F5)", "UNIQUE(F1:F5,FALSE,TRUE)", "UNIQUE(G1:H1,TRUE)"), ["x;Y;z", "z", "1,2"]);
eq("TRANSPOSE", ev("TRANSPOSE(A1:A3)", "TRANSPOSE(G1:H2)"), ["1,2,3", "1,3;2,4"]);
eq("XLOOKUP's return as a row", ev('XLOOKUP("b",D1:D4,D1:E4)'), ["b,3"]);
eq("MAP, REDUCE, SCAN", ev("MAP(A1:A3,LAMBDA(x,x*x))", "REDUCE(0,A1:A3,LAMBDA(a,x,a+x))", "SCAN(0,A1:A3,LAMBDA(a,x,a+x))", "MAP(A1:A2,B1:C1,LAMBDA(x,y,x+y))"), ["1;4;9", "6", "1;3;6", "#VALUE! MAP's arrays differ in size"]);
eq("BYROW, BYCOL, MAKEARRAY", ev("BYROW(G1:H2,LAMBDA(r,SUM(r)))", "BYCOL(G1:H2,LAMBDA(c,SUM(c)))", "MAKEARRAY(2,2,LAMBDA(i,j,i*10+j))", "MAP(A1:A2,5)"),
  ["3;7", "4,6", "11,12;21,22", "#VALUE! MAP takes a LAMBDA last"]);

const wb = new Workbook();
const cmds = new Commands(wb);
const shown = (...keys: string[]) => keys.map((k) => show(wb.sheet.value(k)));
const set = (cell: string, input: string) => cmds.run(`cell.set cell=${cell} input="${input.replace(/"/g, '""')}"`);
await set("A1", "=SEQUENCE(3)");
await set("B1", "=SUM(A1#)");
await set("B2", "=A3*10");
eq("a formula spills below; its cells are read as any; A1# is all of it", [shown("A1", "A2", "A3", "B1", "B2"), wb.sheet.input("A2")], [["1", "2", "3", "6", "30"], ""]);
await set("A1", "=SEQUENCE(4)");
eq("a bigger spill: what reads it follows", shown("A4", "B1", "B2"), ["4", "10", "30"]);
await set("C1", "=A4+1");
eq("something in the way: #SPILL!, the spill gone", [(await set("A3", "x")) && shown("A1", "A2", "B1", "C1"), String((wb.sheet.value("A1") as CellError).why)],
  [["#SPILL!", "", "#SPILL!", "1"], "A3 is in the way"]);
await set("A3", "");
eq("cleared: it spills again", shown("A1", "A3", "B1", "C1"), ["1", "3", "10", "5"]);
await cmds.run("edit.undo");
eq("undo puts the blocker back", shown("A1", "A3"), ["#SPILL!", "x"]);
await cmds.run("edit.redo");
await set("Z99", "=SEQUENCE(3)");
eq("the sheet's edge", [shown("Z99"), String((wb.sheet.value("Z99") as CellError).why)], [["#SPILL!"], "the result does not fit on the sheet"]);
await set("A1", "=SEQUENCE(2)");
eq("a smaller spill leaves what it left empty", shown("A3", "A4", "B1", "C1"), ["", "", "3", "1"]);
await cmds.run("edit.copy range=B1");
await cmds.run("edit.paste at=E2");
eq("A1# moves in a copy", wb.sheet.input("E2"), "=SUM(D2#)");
eq("a spilled cell is styled as what it shows", wb.styleOf("A2"), "text-align: end");
// expect: ok a range is an array; one of one cell its value
// expect: ok arithmetic cell by cell, broadcast, #N/A where one runs out
// expect: ok IF over an array; a function of an array
// expect: ok SEQUENCE
// expect: ok FILTER
// expect: ok SORT and SORTBY
// expect: ok UNIQUE, any case; or what is there exactly once
// expect: ok TRANSPOSE
// expect: ok XLOOKUP's return as a row
// expect: ok MAP, REDUCE, SCAN
// expect: ok BYROW, BYCOL, MAKEARRAY
// expect: ok a formula spills below; its cells are read as any; A1# is all of it
// expect: ok a bigger spill: what reads it follows
// expect: ok something in the way: #SPILL!, the spill gone
// expect: ok cleared: it spills again
// expect: ok undo puts the blocker back
// expect: ok the sheet's edge
// expect: ok a smaller spill leaves what it left empty
// expect: ok A1# moves in a copy
// expect: ok a spilled cell is styled as what it shows
