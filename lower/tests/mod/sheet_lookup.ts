// The library's first batch after GridCraft's list: conditionals (IFS,
// SWITCH, IFNA, NA), lookups (XLOOKUP and XMATCH with their match and search
// modes and wildcards, HLOOKUP), conditional aggregates over several
// criteria (SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS, MINIFS), SUMPRODUCT, and
// order statistics (LARGE, SMALL, RANK, PERCENTILE, QUARTILE, MODE, VAR,
// VARP, STDEVP).
import { evaluate } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

// A1:C6 a small sales table; E1:H2 a row-wise table; J a column of scores.
const cells = new Map<string, Value>([
  ["A1", "region"], ["B1", "rep"], ["C1", "sales"],
  ["A2", "North"], ["B2", "Ann"], ["C2", 100],
  ["A3", "South"], ["B3", "Bob"], ["C3", 250],
  ["A4", "North"], ["B4", "Cy"], ["C4", 175],
  ["A5", "East"], ["B5", "Di"], ["C5", 50],
  ["A6", "North"], ["B6", "Ann"], ["C6", 300],
  ["E1", 10], ["F1", 20], ["G1", 30], ["H1", 40],
  ["E2", "ten"], ["F2", "twenty"], ["G2", "thirty"], ["H2", "forty"],
  ["J1", 2], ["J2", 4], ["J3", 4], ["J4", 4], ["J5", 5], ["J6", 5], ["J7", 7], ["J8", 9],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const ev = (...srcs: string[]): string[] => srcs.map((src) => {
  const v = evaluate(parse(src), env);
  return v instanceof CellError ? `${v.code} ${v.why}` : show(v);
});

eq("IFS: the first true condition's value", ev('IFS(C2>200,"big",C2>50,"middling",TRUE,"small")', 'IFS(C5>500,"big")'), ["middling", "#N/A no condition was true"]);
eq("SWITCH: a value matched, or the default", ev('SWITCH(A3,"North",1,"South",2,0)', 'SWITCH(A5,"North",1,"South",2,0)', 'SWITCH(A5,"North",1)'), ["2", "0", "#N/A East matched no case"]);
eq("IFNA and NA", ev('IFNA(MATCH("West",A2:A6,0),"none")', "IFNA(1/0, 2)", "NA()"), ["none", "#DIV/0! divide by zero", "#N/A NA()"]);

eq("XLOOKUP: exact, down a column, the value beside it", ev('XLOOKUP("Cy",B2:B6,C2:C6)', 'XLOOKUP("cy",B2:B6,A2:A6)'), ["175", "North"]);
eq("not found: an error, or what it says instead", ev('XLOOKUP("Zed",B2:B6,C2:C6)', 'XLOOKUP("Zed",B2:B6,C2:C6,"nobody")'), ["#N/A Zed is not there", "nobody"]);
eq("across a row", ev("XLOOKUP(30,E1:H1,E2:H2)"), ["thirty"]);
eq("next smaller, next larger", ev("XLOOKUP(25,E1:H1,E2:H2,,-1)", "XLOOKUP(25,E1:H1,E2:H2,,1)", "XLOOKUP(45,E1:H1,E2:H2,,1)"), ["twenty", "thirty", "#N/A 45 is not there"]);
eq("wildcards", ev('XLOOKUP("B*",B2:B6,C2:C6,,2)', 'XLOOKUP("?i",B2:B6,C2:C6,,2)', 'XLOOKUP("~*",B2:B6,C2:C6,"no star",2)'), ["250", "50", "no star"]);
eq("last to first", ev('XLOOKUP("Ann",B2:B6,C2:C6,,0,-1)', 'XLOOKUP("Ann",B2:B6,C2:C6,,0,1)'), ["300", "100"]);
eq("XMATCH", ev('XMATCH("North",A2:A6)', 'XMATCH("North",A2:A6,0,-1)', "XMATCH(26,E1:H1,1)"), ["1", "5", "3"]);
eq("lookup and return differ in size", ev("XLOOKUP(1,E1:H1,C2:C3)"), ["#VALUE! XLOOKUP's lookup and return ranges differ in size"]);
eq("HLOOKUP", ev("HLOOKUP(30,E1:H2,2,FALSE)", "HLOOKUP(35,E1:H2,2)", "HLOOKUP(30,E1:H2,3,FALSE)"), ["thirty", "thirty", "#REF! HLOOKUP row 3 of a table 2 high"]);

eq("SUMIFS and COUNTIFS: every criterion holds", ev('SUMIFS(C2:C6,A2:A6,"North",C2:C6,">150")', 'COUNTIFS(A2:A6,"North",B2:B6,"Ann")', 'COUNTIFS(A2:A6,"<>North")'), ["475", "2", "2"]);
eq("AVERAGEIFS, MAXIFS, MINIFS", ev('AVERAGEIFS(C2:C6,A2:A6,"North")', 'MAXIFS(C2:C6,A2:A6,"North")', 'MINIFS(C2:C6,A2:A6,"North")', 'AVERAGEIFS(C2:C6,A2:A6,"West")'),
  ["191.6666667", "300", "100", "#DIV/0! AVERAGEIFS matched no numbers"]);
eq("criteria ranges must be the sum range's size", ev('SUMIFS(C2:C6,A2:A5,"North")'), ["#VALUE! SUMIFS's ranges differ in size"]);
eq("SUMPRODUCT", ev("SUMPRODUCT(E1:H1,E1:H1)", "SUMPRODUCT(C2:C3,J1:J2)", "SUMPRODUCT(C2:C3,J1:J3)"), ["3000", "1200", "#VALUE! SUMPRODUCT's ranges differ in size"]);

eq("LARGE, SMALL", ev("LARGE(C2:C6,1)", "LARGE(C2:C6,2)", "SMALL(C2:C6,1)", "SMALL(C2:C6,6)"), ["300", "250", "50", "#NUM! SMALL's k is 6 of 5 numbers"]);
eq("RANK, descending or ascending, ties sharing", ev("RANK(250,C2:C6)", "RANK(250,C2:C6,1)", "RANK(4,J1:J8)", "RANK(3,J1:J8)"), ["2", "4", "5", "#N/A 3 is not there"]);
eq("PERCENTILE and QUARTILE, inclusive", ev("PERCENTILE(J1:J8,0.5)", "PERCENTILE(J1:J8,0.25)", "QUARTILE(J1:J8,3)", "PERCENTILE(J1:J8,2)"), ["4.5", "4", "5.5", "#NUM! PERCENTILE's k is outside 0 to 1"]);
eq("MODE, VAR, VARP, STDEVP", ev("MODE(J1:J8)", "VAR(E1:H1)", "VARP(E1:H1)", "STDEVP(E1:H1)"), ["4", "166.6666667", "125", "11.18033989"]);
// expect: ok IFS: the first true condition's value
// expect: ok SWITCH: a value matched, or the default
// expect: ok IFNA and NA
// expect: ok XLOOKUP: exact, down a column, the value beside it
// expect: ok not found: an error, or what it says instead
// expect: ok across a row
// expect: ok next smaller, next larger
// expect: ok wildcards
// expect: ok last to first
// expect: ok XMATCH
// expect: ok lookup and return differ in size
// expect: ok HLOOKUP
// expect: ok SUMIFS and COUNTIFS: every criterion holds
// expect: ok AVERAGEIFS, MAXIFS, MINIFS
// expect: ok criteria ranges must be the sum range's size
// expect: ok SUMPRODUCT
// expect: ok LARGE, SMALL
// expect: ok RANK, descending or ascending, ties sharing
// expect: ok PERCENTILE and QUARTILE, inclusive
// expect: ok MODE, VAR, VARP, STDEVP
