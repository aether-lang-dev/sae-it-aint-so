// site/sheet/shift.ts: inserting and deleting rows and columns, as the
// Tauri spreadsheet does. Cells below (or right of) an insertion move down
// (or right); every reference to them follows, $ or not, in either
// language; a range grows over an insertion and shrinks over a deletion; a
// reference into what was deleted is #REF!.
import { addrOf } from "./sheet/address.ts";
import { deleted, inserted, restructured } from "./sheet/shift.ts";
import { EXCEL } from "./sheet/excel.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { CellNotes } from "./sheet/notes.ts";
import { Sheet } from "./sheet/sheet.ts";
import { show } from "./sheet/format.ts";
import { eq, throws } from "./lib/check.ts";

const rexx = new RexxLanguage();
const ex = (input: string, edit: ReturnType<typeof inserted>) => EXCEL.rewrite(input, edit);

eq("an inserted row moves what is at or below it, $ or not", ex("=A1+A3+$A$3+A$4", inserted("row", 2, 1)), "=A1+A4+$A$4+A$5");
eq("a range over it grows; one above or below just moves", [ex("=SUM(A1:A5)", inserted("row", 2, 2)), ex("=SUM(A4:A5)", inserted("row", 2, 1)), ex("=SUM(A1:A2)", inserted("row", 2, 1))],
  ["=SUM(A1:A7)", "=SUM(A5:A6)", "=SUM(A1:A2)"]);
eq("a column inserted", ex("=B1*C2+A1", inserted("col", 1, 1)), "=C1*D2+A1");
eq("a deleted row: references into it are #REF!, below it move up", ex("=A1+A3+A5", deleted("row", 2, 1)), "=A1+#REF!+A4");
eq("a range shrinks over a deletion, or is #REF! when all of it went", [ex("=SUM(A1:A5)", deleted("row", 1, 2)), ex("=SUM(A2:A3)", deleted("row", 1, 2)), ex("=SUM(A3:A6)", deleted("row", 0, 4))],
  ["=SUM(A1:A3)", "=SUM(#REF!)", "=SUM(A1:A2)"]);
eq("a deleted column", ex("=A1+B1+C1", deleted("col", 1, 1)), "=A1+#REF!+B1");
eq("pushed off the end of the sheet is #REF!", ex("=A20", inserted("row", 0, 1)), "=#REF!");
eq("a constant is untouched", ex("A3", inserted("row", 0, 1)), "A3");
eq("RexxJS formulas too, in strings as well", rexx.rewrite('=A3 + SUM_RANGE("A1:A5")', inserted("row", 2, 1)), '=A4 + SUM_RANGE("A1:A6")');
eq("and a deletion there", rexx.rewrite('=A3 + SUM_RANGE("A1:A5")', deleted("row", 2, 1)), '=#REF! + SUM_RANGE("A1:A4")');

const inputs: [string, string][] = [["A1", "1"], ["A2", "2"], ["A3", "=A1+A2"], ["B3", "=SUM(A1:A2)"], ["A5", "=A3*10"]];
eq("the cells move, their formulas rewritten; what moved away is cleared", restructured(inputs, inserted("row", 1, 1), EXCEL),
  [["A2", ""], ["A3", ""], ["B3", ""], ["A5", ""], ["A3", "2"], ["A4", "=A1+A3"], ["B4", "=SUM(A1:A3)"], ["A6", "=A4*10"]]);
eq("a deleted row's cells go", restructured(inputs, deleted("row", 1, 1), EXCEL),
  [["A2", ""], ["A3", ""], ["B3", ""], ["A5", ""], ["A2", "=A1+#REF!"], ["B2", "=SUM(A1:A1)"], ["A4", "=A2*10"]]);
throws("nothing is pushed off the sheet", () => restructured([["A20", "1"]], inserted("row", 3, 1), EXCEL), RangeError, "A20 is not empty: inserting would push it off the sheet");

{
  const notes = new CellNotes();
  notes.set("A3", { comment: "a sum" });
  notes.set("A2", { format: "0.00" });
  notes.remap((a) => inserted("row", 2, 1).cell(a, { col: false, row: false }));
  eq("notes move with their cells", [notes.get("A4"), notes.get("A2"), notes.get("A3")], [{ comment: "a sum" }, { format: "0.00" }, {}]);
  notes.remap((a) => deleted("row", 1, 1).cell(a, { col: false, row: false }));
  eq("and go with a deleted one", [notes.get("A3"), notes.get("A1")], [{ comment: "a sum" }, {}]);
  notes.set("B5", { styleExpression: "STYLE_IF(B5 < 0, RED_TEXT())" });
  const edit = inserted("row", 0, 1);
  notes.remap((a) => edit.cell(a, { col: false, row: false }), (e) => rexx.rewrite(`=${e}`, edit).slice(1));
  eq("a conditional style is rewritten with its cell", notes.get("B6"), { styleExpression: "STYLE_IF(B6 < 0, RED_TEXT())" });
}

{
  const s = new Sheet();
  await s.setMany(inputs);
  await s.setMany(restructured(s.keys().map((k) => [k, s.input(k)]), inserted("row", 1, 1), EXCEL));
  eq("through a Sheet: the values follow", ["A1", "A3", "A4", "B4", "A6"].map((k) => show(s.value(k))), ["1", "2", "3", "3", "30"]);
  await s.undo();
  eq("and one undo puts it back", [s.input("A3"), show(s.value("A5"))], ["=A1+A2", "30"]);
}
eq("rows and columns are counted from 0, as Addr is", addrOf("B3"), { col: 1, row: 2 });
// expect: ok an inserted row moves what is at or below it, $ or not
// expect: ok a range over it grows; one above or below just moves
// expect: ok a column inserted
// expect: ok a deleted row: references into it are #REF!, below it move up
// expect: ok a range shrinks over a deletion, or is #REF! when all of it went
// expect: ok a deleted column
// expect: ok pushed off the end of the sheet is #REF!
// expect: ok a constant is untouched
// expect: ok RexxJS formulas too, in strings as well
// expect: ok and a deletion there
// expect: ok the cells move, their formulas rewritten; what moved away is cleared
// expect: ok a deleted row's cells go
// expect: ok nothing is pushed off the sheet
// expect: ok notes move with their cells
// expect: ok and go with a deleted one
// expect: ok a conditional style is rewritten with its cell
// expect: ok through a Sheet: the values follow
// expect: ok and one undo puts it back
// expect: ok rows and columns are counted from 0, as Addr is
