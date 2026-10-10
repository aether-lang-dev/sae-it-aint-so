// site/sheet/evaluate.ts and format.ts against a fixed set of cells: the
// operators, coercions, functions, errors as values, and how values read.
import { CellError, evaluate, toNumber, toText } from "./sheet/evaluate.ts";
import type { Value } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { describe, fmt, show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

const cells = new Map<string, Value>([
  ["A1", 2], ["A2", 3], ["A3", "4"], ["A4", "pears"], ["A5", true],
  ["B1", new CellError("#DIV/0!", "divide by zero")],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const ev = (src: string): string => show(evaluate(parse(src), env));
const why = (src: string): string => {
  const v = evaluate(parse(src), env);
  return v instanceof CellError ? `${v.code} ${v.why}` : `not an error: ${show(v)}`;
};

eq("arithmetic", [ev("1+2*3"), ev("2^10"), ev("7/2"), ev("-A1"), ev("10-A2-A1")], ["7", "1024", "3.5", "-2", "5"]);
eq("an empty cell is 0, or ''", [ev("Z1"), ev("C9+1"), ev(`C9&"x"`)], ["#REF!", "1", "x"]);
eq("numeric text and TRUE count as numbers", [ev("A3*2"), ev("A5+1")], ["8", "2"]);
eq("& joins, numbers as they read", [ev(`A1&"-"&A4`), ev(`1/4&""`)], ["2-pears", "0.25"]);
eq("comparisons give TRUE or FALSE", [ev("A1<A2"), ev("A1=2"), ev(`A4="PEARS"`), ev(`"a"<"b"`), ev("A1<>2")], ["TRUE", "TRUE", "TRUE", "TRUE", "FALSE"]);
eq("floating point reads as people expect", [ev("0.1+0.2"), ev("1/3")], ["0.3", "0.3333333333"]);

eq("SUM over a range skips text", ev("SUM(A1:A5)"), "5");
eq("SUM over several arguments", ev("SUM(A1, A2, 10)"), "15");
eq("AVERAGE, MIN, MAX, COUNT", [ev("AVERAGE(A1:A2)"), ev("MIN(A1:A3)"), ev("MAX(A1:A2, 9)"), ev("COUNT(A1:A5)")], ["2.5", "2", "9", "2"]);
eq("MIN of nothing is 0", ev("MIN(C1:C3)"), "0");
eq("ROUND, ABS, LEN, CONCAT", [ev("ROUND(2.345, 2)"), ev("ABS(-A2)"), ev("LEN(A4)"), ev(`CONCAT(A1:A2, "!")`)], ["2.35", "3", "5", "23!"]);
eq("IF takes one branch only", [ev("IF(A1>1, 1, 1/0)"), ev("IF(A1>5, 1/0, 7)"), ev("IF(FALSE, 1)")], ["1", "7", "FALSE"]);

eq("divide by zero", why("1/(A1-2)"), "#DIV/0! divide by zero");
eq("text where a number goes", why("A4*2"), "#VALUE! 'pears' is not a number");
eq("an error flows through what reads it", [why("B1+1"), why("SUM(A1:B1)"), why("B1")], [
  "#DIV/0! divide by zero", "#DIV/0! divide by zero", "#DIV/0! divide by zero",
]);
eq("off the sheet", [why("K1"), why("SUM(A1:K2)")], ["#REF! K1 is not on the sheet", "#REF! K2 is not on the sheet"]);
eq("no such function", why("NOPE(1)"), "#NAME? no function NOPE");
eq("a range where one value goes", why("A1:A2+1"), "#VALUE! A1:A2 is a range where one value goes");
eq("wrong argument counts", [why("ABS(1, 2)"), why("ROUND(A1:A2, 1)"), why("IF(1)")], [
  "#VALUE! ABS takes 1 value", "#VALUE! ROUND takes 2 values", "#VALUE! IF takes 2 or 3 values",
]);
eq("an overflow is not a number", why("10^400"), "#VALUE! the result is not a finite number");
eq("AVERAGE of nothing", why("AVERAGE(C1:C2)"), "#DIV/0! AVERAGE of no numbers");

eq("coercions", [toNumber(null), toNumber(" 5 "), toText(true), toText(1e21)], [0, 5, "TRUE", "1e+21"]);
eq("show", [show(null), show(12), show(1 / 3), show(false), show("x"), show(new CellError("#REF!", "gone"))], [
  "", "12", "0.3333333333", "FALSE", "x", "#REF!",
]);
eq("fmt shows each value as a cell would", fmt`${"B3"} is ${2 / 3} (${true}, ${null})`, "B3 is 0.6666666667 (TRUE, )");
eq("describe a cell", [describe("A1", "", null), describe("B1", "=A1*2", 4)], ["A1: (empty)", "B1: =A1*2 → 4"]);
eq("describe an error says why", describe("C1", "=1/0", new CellError("#DIV/0!", "divide by zero")), "C1: =1/0 → #DIV/0! divide by zero");
// expect: ok arithmetic
// expect: ok an empty cell is 0, or ''
// expect: ok numeric text and TRUE count as numbers
// expect: ok & joins, numbers as they read
// expect: ok comparisons give TRUE or FALSE
// expect: ok floating point reads as people expect
// expect: ok SUM over a range skips text
// expect: ok SUM over several arguments
// expect: ok AVERAGE, MIN, MAX, COUNT
// expect: ok MIN of nothing is 0
// expect: ok ROUND, ABS, LEN, CONCAT
// expect: ok IF takes one branch only
// expect: ok divide by zero
// expect: ok text where a number goes
// expect: ok an error flows through what reads it
// expect: ok off the sheet
// expect: ok no such function
// expect: ok a range where one value goes
// expect: ok wrong argument counts
// expect: ok an overflow is not a number
// expect: ok AVERAGE of nothing
// expect: ok coercions
// expect: ok show
// expect: ok fmt shows each value as a cell would
// expect: ok describe a cell
// expect: ok describe an error says why
