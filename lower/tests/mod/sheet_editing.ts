// site/sheet/series.ts and the editing commands that use it: Fill Series
// (a series continued from the first cells), AutoSum, Paste Special (values,
// formulas, formats, transposed), and the Clear variants.
import { continued } from "./sheet/series.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

eq("numbers: by 1 from one, by their step from two", [continued(["1"], 3), continued(["2", "5"], 3), continued(["10", "7.5"], 2)],
  [["2", "3", "4"], ["8", "11", "14"], ["5", "2.5"]]);
eq("dates, by a day or by their step", [continued(["2025-01-30"], 3), continued(["2025-01-01", "2025-01-08"], 2)],
  [["2025-01-31", "2025-02-01", "2025-02-02"], ["2025-01-15", "2025-01-22"]]);
eq("text with a number at the end", [continued(["Item 1"], 2), continued(["Q-07", "Q-09"], 2)], [["Item 2", "Item 3"], ["Q-11", "Q-13"]]);
eq("days, months and quarters, round and round, in the case given", [continued(["Fri"], 4), continued(["November"], 3), continued(["q3"], 3), continued(["MON", "WED"], 2)],
  [["Sat", "Sun", "Mon", "Tue"], ["December", "January", "February"], ["q4", "q1", "q2"], ["FRI", "SUN"]]);
eq("anything else is copied, a formula too (the command moves it)", [continued(["pears"], 2), continued(["=A1*2"], 1)], [["pears", "pears"], ["=A1*2"]]);

const wb = new Workbook();
const cmds = new Commands(wb);
const inputs = (...keys: string[]) => keys.map((k) => wb.sheet.input(k));
const shown = (...keys: string[]) => keys.map((k) => wb.textOf(k));

await cmds.run("cell.set cell=A1 input=Mon");
await cmds.run("cell.set cell=B1 input=2");
await cmds.run("cell.set cell=B2 input=4");
eq("edit.fillSeries down, each column from its own first cells", [(await cmds.run("edit.fillSeries range=A1:B5")).message, inputs("A2", "A5", "B3", "B5")],
  ["filled A1:B5 as a series: 7 cells set, 7 changed", ["Tue", "Fri", "6", "10"]]);
await cmds.run("cell.set cell=D1 input=Jan");
await cmds.run("edit.fillSeries range=D1:G1");
eq("and right, for a selection one row tall", inputs("E1", "G1"), ["Feb", "Apr"]);
await cmds.run('cell.set cell=H5 input="=B5*2"');
await cmds.run("edit.fillSeries range=H5:H7");
eq("a formula in a series is moved, as Fill Down moves it", inputs("H6", "H7"), ["=B6*2", "=B7*2"]);
await cmds.run("range.clear range=H5:H7");

eq("formulas.autoSum: the numbers above", [(await cmds.run("formulas.autoSum cell=B6")).message, inputs("B6"), shown("B6")], ["B6 = 30", ["=SUM(B1:B5)"], ["30"]]);
await cmds.run("cell.set cell=H2 input=Total");
await cmds.run("cell.set cell=I2 input=3");
eq("or, with none just above, the numbers to the left", [(await cmds.run("formulas.autoSum cell=J2")).message, inputs("J2")], ["J2 = 3", ["=SUM(I2:I2)"]]);
eq("none at all, or off the sheet: refused", [(await cmds.run("formulas.autoSum cell=A10")).message, (await cmds.run("formulas.autoSum cell=AA2")).message],
  ["no numbers above or to the left of A10", "AA2 is not a cell on the sheet"]);
await cmds.run("formulas.use language=RexxJS");
await cmds.run("cell.set cell=I3 input=4");
await cmds.run("formulas.autoSum cell=I4");
eq("in RexxJS formulas, SUM_RANGE", [inputs("I4"), shown("I4")], [['=SUM_RANGE("I2:I3")'], ["7"]]);
await cmds.run("formulas.use language=Excel");

await cmds.run('cell.format cell=B6 format="0.00"');
await cmds.run("edit.copy range=B5:B6");
await cmds.run("edit.pasteSpecial at=C5 what=values");
eq("Paste Special values: what the cells showed, no formulas, no formats", [inputs("C5", "C6"), shown("C6")], [["10", "30"], ["30"]]);
await cmds.run("edit.pasteSpecial at=D5 what=formulas");
eq("formulas: moved, without their formats", [inputs("D6"), shown("D6")], [["=SUM(D1:D5)"], ["10"]]);
await cmds.run("edit.pasteSpecial at=E5 what=formats");
eq("formats: the notes alone", [inputs("E6"), wb.notes.get("E6").format], [[""], "0.00"]);
await cmds.run("edit.copy range=A1:B2");
await cmds.run("edit.pasteSpecial at=F10 what=all transpose=true");
eq("transposed: rows become columns", inputs("F10", "G10", "F11", "G11"), ["Mon", "Tue", "2", "4"]);

await cmds.run("cell.comment cell=B6 text=total");
await cmds.run("range.clearFormats range=B6");
eq("range.clearFormats: the format and style go, the input and comment stay", [inputs("B6"), wb.notes.get("B6")], [["=SUM(B1:B5)"], { comment: "total" }]);
await cmds.run("range.clearComments range=B6");
eq("range.clearComments", wb.notes.get("B6"), {});
await cmds.run('cell.format cell=B6 format="0.0"');
await cmds.run("range.clearAll range=B5:B6");
eq("range.clearAll: inputs and notes", [inputs("B5", "B6"), wb.notes.get("B6")], [["", ""], {}]);
await cmds.run("edit.undo");
eq("its inputs come back with an undo", inputs("B5", "B6"), ["10", "=SUM(B1:B5)"]);
// expect: ok numbers: by 1 from one, by their step from two
// expect: ok dates, by a day or by their step
// expect: ok text with a number at the end
// expect: ok days, months and quarters, round and round, in the case given
// expect: ok anything else is copied, a formula too (the command moves it)
// expect: ok edit.fillSeries down, each column from its own first cells
// expect: ok and right, for a selection one row tall
// expect: ok a formula in a series is moved, as Fill Down moves it
// expect: ok formulas.autoSum: the numbers above
// expect: ok or, with none just above, the numbers to the left
// expect: ok none at all, or off the sheet: refused
// expect: ok in RexxJS formulas, SUM_RANGE
// expect: ok Paste Special values: what the cells showed, no formulas, no formats
// expect: ok formulas: moved, without their formats
// expect: ok formats: the notes alone
// expect: ok transposed: rows become columns
// expect: ok range.clearFormats: the format and style go, the input and comment stay
// expect: ok range.clearComments
// expect: ok range.clearAll: inputs and notes
// expect: ok its inputs come back with an undo
