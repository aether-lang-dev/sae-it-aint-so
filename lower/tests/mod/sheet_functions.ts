// site/sheet/functions.ts through formulas, against a fixed set of cells:
// every function in the library, its edge cases, and the errors it gives.
import { evaluate } from "./sheet/evaluate.ts";
import { criterion, names } from "./sheet/functions.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { parse } from "./sheet/parser.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

// A: numbers. B: text with a blank and a gap. C: numbers beside them.
// D: odds and ends. E: an ascending column. F1:H4: a lookup table.
const cells = new Map<string, Value>([
  ["A1", 3], ["A2", 1], ["A3", 4], ["A4", 1], ["A5", 5], ["A6", 9],
  ["B1", "apples"], ["B2", "pears"], ["B3", "apples"], ["B4", ""], ["B6", "Plums"],
  ["C1", 10], ["C2", 20], ["C3", 30], ["C4", 40], ["C5", 50], ["C6", 60],
  ["D1", true], ["D2", new CellError("#DIV/0!", "divide by zero")], ["D3", "  lots   of   space  "], ["D4", "hello world"], ["D5", "5"],
  ["E1", 10], ["E2", 20], ["E3", 30], ["E4", 40], ["E5", 50],
  ["F1", "id"], ["G1", "fruit"], ["H1", "price"],
  ["F2", 1], ["G2", "apple"], ["H2", 0.5],
  ["F3", 2], ["G3", "pear"], ["H3", 0.75],
  ["F4", 3], ["G4", "plum"], ["H4", 1.2],
  ["I1", 40], ["I2", 30], ["I3", 20], ["I4", 10],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const ev = (...srcs: string[]): string[] => srcs.map((src) => show(evaluate(parse(src), env)));
const why = (...srcs: string[]): string[] => srcs.map((src) => {
  const v = evaluate(parse(src), env);
  return v instanceof CellError ? `${v.code} ${v.why}` : `not an error: ${show(v)}`;
});

eq("the library", names().join(" "), [
  "ABS AND AVERAGE AVERAGEIF CHOOSE COLUMNS CONCAT COUNT COUNTA COUNTBLANK COUNTIF EXACT FIND IF IFERROR INDEX INT",
  "ISBLANK ISERROR ISNUMBER ISTEXT LEFT LEN LOWER MATCH MAX MEDIAN MID MIN MOD NOT OR PI POWER PRODUCT PROPER",
  "REPT RIGHT ROUND ROUNDDOWN ROUNDUP ROWS SIGN SQRT STDEV SUBSTITUTE SUM SUMIF TEXTJOIN TRIM UPPER VALUE VLOOKUP",
].join(" "));

// Maths and statistics.
eq("PRODUCT", ev("PRODUCT(A1:A3)", "PRODUCT(B1:B2)"), ["12", "0"]);
eq("MEDIAN, odd and even", ev("MEDIAN(A1:A5)", "MEDIAN(A1:A6)"), ["3", "3.5"]);
eq("STDEV is the sample's", ev("ROUND(STDEV(C1:C6), 4)", "STDEV(2, 4, 4, 4, 5, 5, 7, 9)"), ["18.7083", "2.138089935"]);
eq("COUNTA counts what is there, COUNTBLANK what is not", ev("COUNTA(B1:B6)", "COUNTBLANK(B1:B6)"), ["5", "2"]);
eq("SIGN, INT", ev("SIGN(-3)", "SIGN(0)", "INT(2.7)", "INT(-2.5)"), ["-1", "0", "2", "-3"]);
eq("ROUND away from zero, with or without places", ev("ROUND(2.5)", "ROUND(-2.5)", "ROUND(2.675, 2)", "ROUND(1234, -2)"), ["3", "-3", "2.68", "1200"]);
eq("ROUNDUP and ROUNDDOWN", ev("ROUNDUP(2.01)", "ROUNDUP(-2.01)", "ROUNDDOWN(2.99)", "ROUNDDOWN(-2.99, 1)"), ["3", "-3", "2", "-2.9"]);
eq("MOD takes the divisor's sign", ev("MOD(7, 3)", "MOD(-7, 3)", "MOD(7, -3)", "MOD(5.5, 2)"), ["1", "2", "-2", "1.5"]);
eq("POWER, SQRT, PI", ev("POWER(2, 10)", "SQRT(A6)", "ROUND(PI(), 5)"), ["1024", "3", "3.14159"]);
eq("their errors", why("MOD(1, 0)", "SQRT(-1)", "MEDIAN(B1:B2)", "STDEV(1)"), [
  "#DIV/0! MOD by zero", "#NUM! the square root of a negative number", "#NUM! MEDIAN of no numbers", "#DIV/0! STDEV needs two numbers or more",
]);
eq("an error in a range flows out of an aggregate", why("SUM(D1:D2)", "MAX(D2, 1)"), ["#DIV/0! divide by zero", "#DIV/0! divide by zero"]);

// Conditional sums and counts.
eq("COUNTIF by text, ignoring case", ev(`COUNTIF(B1:B6, "apples")`, `COUNTIF(B1:B6, "PLUMS")`), ["2", "1"]);
eq("COUNTIF by comparison", ev(`COUNTIF(A1:A6, ">3")`, `COUNTIF(A1:A6, "<=1")`, `COUNTIF(A1:A6, "<>1")`, "COUNTIF(A1:A6, 1)"), ["3", "2", "4", "2"]);
eq("COUNTIF of blanks, and of what is not", ev(`COUNTIF(B1:B6, "")`, `COUNTIF(B1:B6, "<>")`), ["2", "4"]);
eq("a number criterion skips text, and text skips numbers", ev(`COUNTIF(B1:B6, ">0")`, `COUNTIF(A1:A6, "apples")`), ["0", "0"]);
eq("SUMIF over another range", ev(`SUMIF(B1:B6, "apples", C1:C6)`, `SUMIF(A1:A6, ">3")`), ["40", "18"]);
eq("AVERAGEIF", ev(`AVERAGEIF(B1:B6, "apples", C1:C6)`), ["20"]);
eq("AVERAGEIF of nothing", why(`AVERAGEIF(B1:B6, "kiwis", C1:C6)`), ["#DIV/0! AVERAGEIF matched no numbers"]);
eq("criterion on its own", [criterion(">=4")(4), criterion(">=4")(3), criterion("=pears")("Pears"), criterion("")(null), criterion(3)("3")], [true, false, true, true, false]);

// Logic and information.
eq("AND, OR, NOT", ev("AND(A1>1, A2=1)", "AND(A1:A6)", "OR(A2>1, FALSE)", "OR(D1)", "NOT(A1=3)"), ["TRUE", "TRUE", "FALSE", "TRUE", "FALSE"]);
eq("AND with nothing true or false to look at", why("AND(B1:B2)"), ["#VALUE! AND found no TRUE or FALSE"]);
eq("IFERROR catches, and passes the rest", ev(`IFERROR(1/0, "none")`, `IFERROR(D2, 0)`, `IFERROR(A1, "none")`), ["none", "0", "3"]);
eq("IS functions", ev("ISERROR(D2)", "ISERROR(A1)", "ISNUMBER(A1)", "ISNUMBER(D5)", "ISTEXT(B1)", "ISBLANK(B5)", "ISBLANK(B4)"), [
  "TRUE", "FALSE", "TRUE", "FALSE", "TRUE", "TRUE", "FALSE",
]);
eq("CHOOSE", ev(`CHOOSE(2, "a", "b", "c")`, "CHOOSE(A2, C1, C2)"), ["b", "10"]);
eq("CHOOSE out of range", why(`CHOOSE(4, "a", "b")`), ["#VALUE! CHOOSE has no choice 4"]);

// Text.
eq("case", ev("UPPER(B1)", `LOWER("MiXeD")`, `PROPER("the o'neil BROTHERS")`), ["APPLES", "mixed", "The O'Neil Brothers"]);
eq("TRIM collapses spaces", ev("TRIM(D3)", "LEN(TRIM(D3))"), ["lots of space", "13"]);
eq("LEFT, RIGHT, MID", ev("LEFT(D4)", "LEFT(D4, 5)", "RIGHT(D4, 5)", "RIGHT(D4, 0)", "MID(D4, 7, 3)", "LEFT(D4, 99)"), ["h", "hello", "world", "", "wor", "hello world"]);
eq("FIND is case-sensitive, from a start", ev(`FIND("o", D4)`, `FIND("o", D4, 6)`, `FIND("w", D4)`), ["5", "8", "7"]);
eq("FIND not finding", why(`FIND("W", D4)`), ["#VALUE! 'W' is not in 'hello world'"]);
eq("SUBSTITUTE, REPT, EXACT", ev(`SUBSTITUTE(D4, "o", "0")`, `SUBSTITUTE(D4, "", "x")`, `REPT("ab", 3)`, `EXACT("a", "A")`, `EXACT(B1, B3)`), [
  "hell0 w0rld", "hello world", "ababab", "FALSE", "TRUE",
]);
eq("TEXTJOIN, skipping blanks or not", ev(`TEXTJOIN(", ", TRUE, B1:B6)`, `TEXTJOIN("-", FALSE, B1:B4)`), ["apples, pears, apples, Plums", "apples-pears-apples-"]);
eq("VALUE", ev("VALUE(D5)+1", `VALUE(" 2.5 ")`), ["6", "2.5"]);
eq("VALUE of words", why("VALUE(B1)"), ["#VALUE! 'apples' is not a number"]);

// Lookup.
eq("ROWS and COLUMNS", ev("ROWS(F1:H4)", "COLUMNS(F1:H4)", "ROWS(A1)"), ["4", "3", "1"]);
eq("INDEX by row and column, or along a list", ev("INDEX(F1:H4, 3, 2)", "INDEX(A1:A6, 6)", "INDEX(F1:H1, 3)"), ["pear", "9", "price"]);
eq("INDEX outside", why("INDEX(F1:H4, 5, 1)"), ["#REF! INDEX 5, 1 is outside 4 x 3"]);
eq("MATCH exact, ignoring case", ev(`MATCH("PEAR", G1:G4, 0)`, "MATCH(3, F1:F4, 0)"), ["3", "4"]);
eq("MATCH approximate: the largest at most", ev("MATCH(35, E1:E5)", "MATCH(50, E1:E5, 1)", "MATCH(10, E1:E5)"), ["3", "5", "1"]);
eq("MATCH descending: the smallest at least", ev("MATCH(25, I1:I4, -1)", "MATCH(40, I1:I4, -1)", "MATCH(10, I1:I4, -1)"), ["2", "1", "4"]);
eq("MATCH not finding", why(`MATCH("kiwi", G1:G4, 0)`, "MATCH(5, E1:E5)"), ["#N/A kiwi is not there", "#N/A 5 is not there"]);
eq("VLOOKUP exact", ev("VLOOKUP(2, F2:H4, 2, FALSE)", "VLOOKUP(3, F2:H4, 3, 0)"), ["pear", "1.2"]);
eq("VLOOKUP approximate", ev("VLOOKUP(2.5, F2:H4, 2)", "VLOOKUP(9, F2:H4, 3, TRUE)"), ["pear", "1.2"]);
eq("VLOOKUP's errors", why("VLOOKUP(7, F2:H4, 2, FALSE)", "VLOOKUP(2, F2:H4, 4, FALSE)", "VLOOKUP(2, F2:H4, 0)", "VLOOKUP(0.5, F2:H4, 2)"), [
  "#N/A 7 is not there", "#REF! VLOOKUP column 4 of a table 3 wide", "#VALUE! VLOOKUP's column starts at 1", "#N/A 0.5 is not there",
]);
eq("a lookup in a formula", ev(`"A " & VLOOKUP(1, F2:H4, 2, FALSE) & " costs " & INDEX(H2:H4, MATCH("apple", G2:G4, 0))`), ["A apple costs 0.5"]);
// expect: ok the library
// expect: ok PRODUCT
// expect: ok MEDIAN, odd and even
// expect: ok STDEV is the sample's
// expect: ok COUNTA counts what is there, COUNTBLANK what is not
// expect: ok SIGN, INT
// expect: ok ROUND away from zero, with or without places
// expect: ok ROUNDUP and ROUNDDOWN
// expect: ok MOD takes the divisor's sign
// expect: ok POWER, SQRT, PI
// expect: ok their errors
// expect: ok an error in a range flows out of an aggregate
// expect: ok COUNTIF by text, ignoring case
// expect: ok COUNTIF by comparison
// expect: ok COUNTIF of blanks, and of what is not
// expect: ok a number criterion skips text, and text skips numbers
// expect: ok SUMIF over another range
// expect: ok AVERAGEIF
// expect: ok AVERAGEIF of nothing
// expect: ok criterion on its own
// expect: ok AND, OR, NOT
// expect: ok AND with nothing true or false to look at
// expect: ok IFERROR catches, and passes the rest
// expect: ok IS functions
// expect: ok CHOOSE
// expect: ok CHOOSE out of range
// expect: ok case
// expect: ok TRIM collapses spaces
// expect: ok LEFT, RIGHT, MID
// expect: ok FIND is case-sensitive, from a start
// expect: ok FIND not finding
// expect: ok SUBSTITUTE, REPT, EXACT
// expect: ok TEXTJOIN, skipping blanks or not
// expect: ok VALUE
// expect: ok VALUE of words
// expect: ok ROWS and COLUMNS
// expect: ok INDEX by row and column, or along a list
// expect: ok INDEX outside
// expect: ok MATCH exact, ignoring case
// expect: ok MATCH approximate: the largest at most
// expect: ok MATCH descending: the smallest at least
// expect: ok MATCH not finding
// expect: ok VLOOKUP exact
// expect: ok VLOOKUP approximate
// expect: ok VLOOKUP's errors
// expect: ok a lookup in a formula
