// site/rexxsheet/view.ts: what the grid shows of the app's model, a cell at
// a time, with no ui: the text, the editor's text, the style, the status
// line, and the grid's columns as cell names.
import { cellRef, describe, editText, refAt, shown, styleOf } from "./rexxsheet/view.ts";
import { eq } from "./lib/check.ts";

const cell = (c: object) => ({ value: "", expression: null, error: null, comment: "", ...c });

eq("the grid's column 0 is the row numbers; then A, B, ... Z", [refAt(0, 0), refAt(0, 1), refAt(9, 2), refAt(99, 26)], [null, "A1", "B10", "Z100"]);
eq("a typed name, either case, with spaces", [cellRef("b12"), cellRef(" Z100 ")], ["B12", "Z100"]);
eq("not a cell, or not on the sheet", [cellRef("AA1"), cellRef("A101"), cellRef("A0"), cellRef("1A"), cellRef("A01"), cellRef("")], [null, null, null, null, null, null]);
eq("past the sheet is nothing", [refAt(100, 1), refAt(0, 27), refAt(-1, 1)], [null, null, null]);

eq("a cell shows its value", [shown(cell({ value: "pears" })), shown(cell({ value: 12 })), shown(cell({}))], ["pears", "12", ""]);
eq("numbers as people read them", [shown(cell({ value: 0.1 + 0.2 })), shown(cell({ value: 1 / 3 }))], ["0.3", "0.3333333333"]);
eq("true and false as Rexx has them", [shown(cell({ value: true })), shown(cell({ value: false }))], ["1", "0"]);

eq("the editor opens on the formula", editText(cell({ value: 30, expression: "A1 + A2" })), "=A1 + A2");
eq("or on the value typed", [editText(cell({ value: "10" })), editText(cell({}))], ["10", ""]);

eq("numbers to the right, a number typed as text too", [styleOf(cell({ value: 3 })), styleOf(cell({ value: "1200" })), styleOf(cell({ value: "pears" }))], ["text-align: end", "text-align: end", ""]);
eq("errors in red", [styleOf(cell({ value: "#ERROR!", error: "x" })), styleOf(cell({ value: "#CIRCULAR!", error: "y" }))], ["color: #c0392b", "color: #c0392b"]);

eq("the status line: what was typed and what it came to", describe("A4", cell({ value: 30, expression: "A1 + A2" })), "A4: =A1 + A2 → 30");
eq("with the comment the file gave it", describe("A5", cell({ value: 60, expression: 'SUM_RANGE("A1:A3")', comment: "Sum of range A1 to A3" })),
  'A5: =SUM_RANGE("A1:A3") → 60 (Sum of range A1 to A3)');
eq("an error's last line says why", describe("E1", cell({ value: "#ERROR!", expression: "1/0", error: "Expression error: Error at line 1: LET CELLRESULT = undefined\nDivision by zero" })),
  "E1: =1/0 → #ERROR! Division by zero");
eq("empty", describe("C9", cell({})), "C9: (empty)");
// expect: ok the grid's column 0 is the row numbers; then A, B, ... Z
// expect: ok a typed name, either case, with spaces
// expect: ok not a cell, or not on the sheet
// expect: ok past the sheet is nothing
// expect: ok a cell shows its value
// expect: ok numbers as people read them
// expect: ok true and false as Rexx has them
// expect: ok the editor opens on the formula
// expect: ok or on the value typed
// expect: ok numbers to the right, a number typed as text too
// expect: ok errors in red
// expect: ok the status line: what was typed and what it came to
// expect: ok with the comment the file gave it
// expect: ok an error's last line says why
// expect: ok empty
