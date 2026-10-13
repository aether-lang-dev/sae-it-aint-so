// A formula as it is typed (the grid's on_edit_change, aether-ui 08e3193d):
// the references it names, in order, each in its own colour round the
// cells it covers, as Excel colours them; and whether the caret is where a
// reference may go, so a click on a cell puts its reference there (point
// mode). Both languages.
import { EXCEL } from "./sheet/excel.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { pointable, REFERENCE_COLOURS } from "./sheet/typing.ts";
import { Workbook } from "./sheet/workbook.ts";
import { eq } from "./lib/check.ts";

eq("Excel: the references a formula names, in order, once each; not names or functions", EXCEL.references("SUM(B1:B3)*$c$2 + b1:b3 - Costs!A1 + rate"), ["B1:B3", "C2", "COSTS!A1"]);
eq("one that does not lex yet is what it has so far", EXCEL.references('A1 + "unfinished'), ["A1"]);
eq("RexxJS: names and ranges in strings", new RexxLanguage().references('A1 + SUM_RANGE("B1:B3") * a1'), ["A1", "B1:B3"]);

eq("pointable: after =, an operator, ( , or :, spaces aside", [pointable("=", 1), pointable("=A1+", 4), pointable("=SUM(", 5), pointable("=SUM(A1, ", 9), pointable("=A1", 3), pointable("A1+", 3), pointable("=A1+B2", 4)],
  [true, true, true, true, false, false, true]);

const wb = new Workbook();
wb.typing("=B2*C3+SUM(D1:E2)");
const [c1, c2, c3] = REFERENCE_COLOURS;
eq("the workbook draws each reference round its cells, in its colour", [wb.styleOf("B2"), wb.styleOf("C3")],
  [`border-top: 2px solid ${c1}; border-right: 2px solid ${c1}; border-bottom: 2px solid ${c1}; border-left: 2px solid ${c1}`,
    `border-top: 2px solid ${c2}; border-right: 2px solid ${c2}; border-bottom: 2px solid ${c2}; border-left: 2px solid ${c2}`]);
eq("a range by its outline", [wb.styleOf("D1"), wb.styleOf("E2")],
  [`border-top: 2px solid ${c3}; border-left: 2px solid ${c3}`, `border-right: 2px solid ${c3}; border-bottom: 2px solid ${c3}`]);
wb.typing(null);
eq("and no more once it is entered", wb.styleOf("B2"), "");
wb.typing("plain text");
eq("text is no formula", wb.styleOf("B2"), "");
// expect: ok Excel: the references a formula names, in order, once each; not names or functions
// expect: ok one that does not lex yet is what it has so far
// expect: ok RexxJS: names and ranges in strings
// expect: ok pointable: after =, an operator, ( , or :, spaces aside
// expect: ok the workbook draws each reference round its cells, in its colour
// expect: ok a range by its outline
// expect: ok and no more once it is entered
// expect: ok text is no formula
