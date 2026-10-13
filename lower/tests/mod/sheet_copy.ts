// site/sheet/copy.ts: a formula moved to another cell shifts its relative
// references and keeps its $-fixed ones; a copy is tab-separated text that
// remembers where it came from; a fill repeats the first row (or column) of
// a selection across the rest.
import { addrOf } from "./sheet/address.ts";
import { copied, filled, pasted } from "./sheet/copy.ts";
import { EXCEL, moved } from "./sheet/excel.ts";
import { eq } from "./lib/check.ts";

const by = (cols: number, rows: number) => ({ cols, rows });
const at = (key: string) => addrOf(key)!;

eq("a relative reference moves with the cell", moved("=A1+B2", by(1, 2)), "=B3+C4");
eq("$ fixes a column, a row, or both", moved("=$A1+A$1+$A$1", by(2, 3)), "=$A4+C$1+$A$1");
eq("a range moves both its corners", moved("=SUM(A1:B2)", by(0, 1)), "=SUM(A2:B3)");
eq("half-fixed ranges, as a running total", moved("=SUM($A$1:A1)", by(0, 4)), "=SUM($A$1:A5)");
eq("everything else is kept as typed", moved(`= sum( a1 ,  "A1" ) & a1b`, by(1, 0)), `= sum( B1 ,  "A1" ) & a1b`);
eq("a fixed reference keeps its case too", moved("=$a$1+a1", by(0, 1)), "=$a$1+A2");
eq("one that leaves the sheet becomes #REF!", moved("=A1+J20", by(1, 0)), "=B1+#REF!");
eq("and above or left of it", moved("=B2*2", by(-2, 0)), "=#REF!*2");
eq("a range with a corner off the sheet is #REF! whole", moved("=SUM(A1:J2)", by(1, 0)), "=SUM(#REF!)");
eq("a reference already off the sheet stays #REF!", moved("=K9", by(0, 1)), "=#REF!");
eq("a constant is not a formula", moved("A1", by(1, 1)), "A1");
eq("a formula that does not lex is left alone", moved(`=A1&"open`, by(1, 1)), `=A1&"open`);
eq("not moving changes nothing", moved("=a1+k9", by(0, 0)), "=a1+k9");

const inputs: Record<string, string> = { A1: "1", B1: "=A1*2", A2: "x", B2: "=$A$1+A2" };
const input = (key: string) => inputs[key] ?? "";

eq("a copy is the inputs as tab-separated rows", copied(input, at("B2"), at("A1")), "1\t=A1*2\nx\t=$A$1+A2");
eq("a one-cell copy", copied(input, at("B1"), at("B1")), "=A1*2");

eq("pasted places rows of tabs at a cell", pasted("a\tb\n1\t=A2\n", at("B1")), [["B1", "a"], ["C1", "b"], ["B2", "1"], ["C2", "=A2"]]);
eq("and drops what falls off the sheet", pasted("1\t2\t3\r\n4\t5\t6", at("I20")), [["I20", "1"], ["J20", "2"]]);
eq("text from elsewhere keeps its formulas as written", pasted("=A1", at("C3")), [["C3", "=A1"]]);
eq("a copy pasted elsewhere moves its formulas", pasted("=A1*2\t=$A$1+A2", at("C5"), { from: at("B1"), language: EXCEL }), [["C5", "=B5*2"], ["D5", "=$A$1+B6"]]);

eq("fill down repeats the top row, moved", filled(input, at("A1"), at("B3"), "down", EXCEL),
  [["A2", "1"], ["B2", "=A2*2"], ["A3", "1"], ["B3", "=A3*2"]]);
eq("fill right repeats the left column", filled(input, at("A1"), at("C2"), "right", EXCEL),
  [["B1", "1"], ["C1", "1"], ["B2", "x"], ["C2", "x"]]);
eq("a one-row selection fills from the row above", filled(input, at("B2"), at("B2"), "down", EXCEL), [["B2", "=A2*2"]]);
eq("a one-column selection from the column left", filled(input, at("B2"), at("B2"), "right", EXCEL), [["B2", "x"]]);
eq("either corner first", filled(input, at("B3"), at("A1"), "down", EXCEL), filled(input, at("A1"), at("B3"), "down", EXCEL));
eq("nothing above the first row to fill from", filled(input, at("A1"), at("B1"), "down", EXCEL), []);
eq("an empty source empties the rest", filled(input, at("C1"), at("C2"), "down", EXCEL), [["C2", ""]]);
eq("fill up repeats the bottom row, moved; fill left the right column", [filled(input, at("B1"), at("B2"), "up", EXCEL), filled(input, at("A1"), at("B1"), "left", EXCEL)],
  [[["B1", "=$A$1+A1"]], [["A1", "=#REF!*2"]]]);
eq("one line thick, from the line beyond it; nothing beyond the last row", [filled(input, at("A1"), at("A1"), "up", EXCEL), filled(input, at("A20"), at("B20"), "up", EXCEL)],
  [[["A1", "x"]], []]);
eq("a source of two lines, repeated", filled(input, at("A1"), at("A4"), "down", EXCEL, 2), [["A3", "1"], ["A4", "x"]]);
// expect: ok a relative reference moves with the cell
// expect: ok $ fixes a column, a row, or both
// expect: ok a range moves both its corners
// expect: ok half-fixed ranges, as a running total
// expect: ok everything else is kept as typed
// expect: ok a fixed reference keeps its case too
// expect: ok one that leaves the sheet becomes #REF!
// expect: ok and above or left of it
// expect: ok a range with a corner off the sheet is #REF! whole
// expect: ok a reference already off the sheet stays #REF!
// expect: ok a constant is not a formula
// expect: ok a formula that does not lex is left alone
// expect: ok not moving changes nothing
// expect: ok a copy is the inputs as tab-separated rows
// expect: ok a one-cell copy
// expect: ok pasted places rows of tabs at a cell
// expect: ok and drops what falls off the sheet
// expect: ok text from elsewhere keeps its formulas as written
// expect: ok a copy pasted elsewhere moves its formulas
// expect: ok fill down repeats the top row, moved
// expect: ok fill right repeats the left column
// expect: ok a one-row selection fills from the row above
// expect: ok a one-column selection from the column left
// expect: ok either corner first
// expect: ok nothing above the first row to fill from
// expect: ok an empty source empties the rest
// expect: ok fill up repeats the bottom row, moved; fill left the right column
// expect: ok one line thick, from the line beyond it; nothing beyond the last row
// expect: ok a source of two lines, repeated
