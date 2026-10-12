// site/sheet/formats.ts and notes.ts: what a cell carries besides its input
// (a comment, a number format, a style, a conditional style), as the Tauri
// spreadsheet's files have them; and file.ts reading its formatted sample.
import { formatted, toStyle } from "./sheet/formats.ts";
import { CellNotes } from "./sheet/notes.ts";
import { readSheetFile } from "./sheet/file.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { Sheet } from "./sheet/sheet.ts";
import { FORMATTED } from "./sheet/samples.ts";
import { CellError } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

eq("the app's number formats", [formatted(3.14159, "number:0.00"), formatted(3.5, "number:0"), formatted(1234.5, "currency:USD"), formatted(-7, "currency:EUR"), formatted(0.256, "percent:0.0%")],
  ["3.14", "4", "$1,234.50", "-€7.00", "25.6%"]);
eq("Excel-style ones, as the formatted sample has", [formatted(1000, "$#,##0.00"), formatted(-150.5, "$#,##0.00"), formatted(0.85, "0.00%"), formatted(1234567, "#,##0"), formatted(2.5, "0.000")],
  ["$1,000.00", "-$150.50", "85.00%", "1,234,567", "2.500"]);
eq("a format among style parts", formatted(0.5, "bold;percent:0%;color:red"), "50%");
eq("text, an empty cell or an error is not a number to format", [formatted("pears", "0.00"), formatted(null, "0.00"), formatted(new CellError("#DIV/0!", "x"), "0.00"), formatted(3, "")],
  [null, null, null, null]);

eq("the app's style strings, as the grid draws them", toStyle("bold;italic;color:red;background:yellow;align:center"),
  "font-weight: bold; color: #ff0000; background: #ffff00; text-align: center");
eq("CSS objects, as the formatted sample's styles are", toStyle({ fontWeight: "bold", fontSize: "16px", backgroundColor: "#2196F3", color: "white", textAlign: "center" }),
  "font-weight: bold; background: #2196f3; color: #ffffff; text-align: center");
eq("JSON of one, as a RexxJS style function gives", toStyle('{"color":"#d32f2f"}'), "color: #d32f2f");
eq("AeCS as it is, right and left as the grid says them", [toStyle("background: #ffe0e0; text-align: right"), toStyle("align:left")], ["background: #ffe0e0; text-align: end", "text-align: start"]);
eq("what the grid cannot draw is left out, and nothing is nothing", [toStyle("underline;font-size:20px"), toStyle(""), toStyle(null), toStyle("color: not-a-colour")], ["", "", "", ""]);

{
  const notes = new CellNotes();
  notes.set("A1", { comment: "the total" });
  notes.set("A1", { format: "0.00" });
  notes.set("B2", { styleExpression: "STYLE_IF(B2 < 0, RED_TEXT(), GREEN_TEXT())" });
  eq("notes are per cell, set a part at a time", [notes.get("A1"), notes.get("C3")], [{ comment: "the total", format: "0.00" }, {}]);
  eq("the cells with a conditional style", notes.conditional(), [["B2", "STYLE_IF(B2 < 0, RED_TEXT(), GREEN_TEXT())"]]);
  notes.set("A1", { comment: "" });
  eq("an empty part is no part", notes.get("A1"), { format: "0.00" });
  notes.clear();
  eq("and all can go", notes.get("A1"), {});
}

const file = readSheetFile(FORMATTED);
eq("the formatted sample's cells: text, a formula in content, a number", file.sheets[0].entries.filter(([k]) => ["A1", "A4", "D5", "C5"].includes(k)),
  [["A1", "Account Ledger"], ["A4", "2025-01-15"], ["C5", "-150.50"], ["D5", "=D4 + C5"]]);
eq("and their notes: a format, a style, a conditional style", [file.sheets[0].notes.get("C5"), file.sheets[0].notes.get("A3")],
  [{ format: "$#,##0.00", styleExpression: "STYLE_IF(C5 < 0, RED_TEXT(), GREEN_TEXT())" }, { style: { fontWeight: "bold", backgroundColor: "#f5f5f5" } }]);

const rexx = new RexxLanguage();
const s = new Sheet(undefined, rexx);
await s.setMany(file.sheets[0].entries);
eq("its ledger works out", [s.value("D9"), s.value("C11"), s.value("D12")], [3998.75, 3998.75, 3998.75]);
const styles = await Promise.all(["C5", "C6", "G4", "G5", "G7", "G10"].map(async (k) => toStyle(await s.evaluate(file.sheets[0].notes.get(k)!.styleExpression!))));
eq("conditional styles, worked out in the sheet's language, by the app's style functions", styles,
  ["color: #d32f2f", "color: #388e3c", "background: #e8f5e9", "background: #ffebee", "background: #fff9c4", "background: #bbdefb; color: #0d47a1"]);
eq("one that fails is no style", toStyle(await s.evaluate("NOSUCH()")), "");
// expect: ok the app's number formats
// expect: ok Excel-style ones, as the formatted sample has
// expect: ok a format among style parts
// expect: ok text, an empty cell or an error is not a number to format
// expect: ok the app's style strings, as the grid draws them
// expect: ok CSS objects, as the formatted sample's styles are
// expect: ok JSON of one, as a RexxJS style function gives
// expect: ok AeCS as it is, right and left as the grid says them
// expect: ok what the grid cannot draw is left out, and nothing is nothing
// expect: ok notes are per cell, set a part at a time
// expect: ok the cells with a conditional style
// expect: ok an empty part is no part
// expect: ok and all can go
// expect: ok the formatted sample's cells: text, a formula in content, a number
// expect: ok and their notes: a format, a style, a conditional style
// expect: ok its ledger works out
// expect: ok conditional styles, worked out in the sheet's language, by the app's style functions
// expect: ok one that fails is no style
