// Conditional-format rules (site/sheet/rules.ts), as Excel's Conditional
// Formatting menu has them: Highlight Cells (a comparison, between, text
// that contains), Top/Bottom (n or n%), Above/Below Average, Duplicate or
// Unique values, two- and three-colour scales, icon sets. Then the format.*
// commands: rules per sheet, the first one listed winning, moving with rows,
// listed and deleted, saved and opened.
import { applied, describeRule } from "./sheet/rules.ts";
import type { CfRule } from "./sheet/rules.ts";
import { parseRange } from "./sheet/address.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { writeSheetFile } from "./sheet/file.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const cells: Record<string, Value> = { A1: 10, A2: 20, A3: 30, A4: 40, A5: 50, B1: "pear", B2: "Apple", B3: "apple", B4: "fig", B5: null };
const at = (s: string) => parseRange(s)!;
const RED = "background: #ffc7ce";
const marks = (rule: CfRule) => [...applied([rule], (k) => cells[k] ?? null)].map(([k, m]) => `${k} ${m.style ?? ""}${m.icon ?? ""}`);

eq("highlight: a comparison", marks({ kind: "cellValue", range: at("A1:A5"), op: ">", value: "30", style: RED }), [`A4 ${RED}`, `A5 ${RED}`]);
eq("between, inclusive", marks({ kind: "cellValue", range: at("A1:A5"), op: "between", value: "20", value2: "30", style: RED }), [`A2 ${RED}`, `A3 ${RED}`]);
eq("text that contains, any case", marks({ kind: "cellValue", range: at("B1:B5"), op: "contains", value: "PP", style: RED }), [`B2 ${RED}`, `B3 ${RED}`]);
eq("equal to text, any case", marks({ kind: "cellValue", range: at("B1:B5"), op: "=", value: "apple", style: RED }), [`B2 ${RED}`, `B3 ${RED}`]);
eq("top 2, bottom 20%", [marks({ kind: "top", range: at("A1:A5"), n: 2, bottom: false, percent: false, style: RED }), marks({ kind: "top", range: at("A1:A5"), n: 20, bottom: true, percent: true, style: RED })],
  [[`A4 ${RED}`, `A5 ${RED}`], [`A1 ${RED}`]]);
eq("above and below average", [marks({ kind: "average", range: at("A1:A5"), below: false, style: RED }), marks({ kind: "average", range: at("A1:A5"), below: true, style: RED })],
  [[`A4 ${RED}`, `A5 ${RED}`], [`A1 ${RED}`, `A2 ${RED}`]]);
eq("duplicates and uniques, any case, empty cells left out", [marks({ kind: "duplicates", range: at("B1:B5"), unique: false, style: RED }), marks({ kind: "duplicates", range: at("B1:B5"), unique: true, style: RED })],
  [[`B2 ${RED}`, `B3 ${RED}`], [`B1 ${RED}`, `B4 ${RED}`]]);
eq("a two-colour scale, min to max", marks({ kind: "colorScale", range: at("A1:A5"), colors: ["#ffffff", "#000000"] }),
  ["A1 background: #ffffff", "A2 background: #bfbfbf", "A3 background: #808080", "A4 background: #404040", "A5 background: #000000"]);
eq("three colours: the middle at the median", marks({ kind: "colorScale", range: at("A1:A4"), colors: ["#ff0000", "#ffffff", "#0000ff"] }),
  ["A1 background: #ff0000", "A2 background: #ffaaaa", "A3 background: #aaaaff", "A4 background: #0000ff"]);
eq("an icon set: thirds of the range", marks({ kind: "iconSet", range: at("A1:A5"), icons: "arrows" }), ["A1 ↓", "A2 ↓", "A3 →", "A4 ↑", "A5 ↑"]);
eq("described", [describeRule({ kind: "top", range: at("A1:A5"), n: 10, bottom: true, percent: true, style: RED }), describeRule({ kind: "cellValue", range: at("A1:A5"), op: "between", value: "1", value2: "5", style: RED }),
  describeRule({ kind: "colorScale", range: at("A1:A5"), colors: ["#f8696b", "#63be7b"] })],
  ["A1:A5: bottom 10%", "A1:A5: cell value between 1 and 5", "A1:A5: colour scale #f8696b, #63be7b"]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
for (let r = 1; r <= 5; r++) await cmds.run(`cell.set cell=A${r} input=${r * 10}`);
eq("format.highlight, Excel's light red fill by default", [await message("format.highlight range=A1:A5 op=greater value=30"), wb.styleOf("A5"), wb.styleOf("A1")],
  ["A1:A5: cell value > 30", "text-align: end; background: #ffc7ce; color: #9c0006", "text-align: end"]);
eq("a style of one's own, in the app's dialect", [await message('format.aboveAverage range=A1:A5 below=1 style="bg:#c6efce"'), wb.styleOf("A1")],
  ["A1:A5: below average", "text-align: end; background: #c6efce"]);
eq("an icon set shows in the text", [await message("format.iconSet range=A1:A5 icons=triangles"), wb.textOf("A5"), wb.textOf("A1")], ["A1:A5: icon set triangles", "▲ 50", "▼ 10"]);
eq("the first rule listed wins", [await message("format.topBottom range=A1:A5 n=1 style=bg:#000000"), wb.styleOf("A5").endsWith("background: #ffc7ce; color: #9c0006")],
  ["A1:A5: top 1", true]);
eq("rules follow an edit", [(await cmds.run("cell.set cell=A1 input=99")) && wb.styleOf("A1").includes("#ffc7ce")], [true]);
eq("format.rules lists them in order", (await cmds.run("format.rules")).output,
  ["1. A1:A5: cell value > 30", "2. A1:A5: below average", "3. A1:A5: icon set triangles", "4. A1:A5: top 1"]);
await cmds.run("rows.insert at=1");
eq("rows inserted move them", (await cmds.run("format.rules")).output?.[0], "1. A2:A6: cell value > 30");
eq("saved with the sheet", writeSheetFile(wb).rules.length, 4);
eq("format.deleteRule, and refusals", [await message("format.deleteRule index=4"), await message("format.deleteRule index=9"), await message("format.highlight range=A1 op=near value=1"), await message("format.colorScale range=A1:A3 colors=red")],
  ["deleted A2:A6: top 1", "no rule 9", "near is not a comparison (greater, less, between, equal, notEqual, greaterOrEqual, lessOrEqual, contains)", "a colour scale takes 2 or 3 colours (#rrggbb)"]);
eq("format.clearRules: the rules over a range", [await message("format.clearRules range=A3"), (await cmds.run("format.rules")).output], ["cleared 3 rules", []]);
{
  const again = new Workbook();
  const replay = new Commands(again);
  await replay.run("cell.set cell=A1 input=5");
  await replay.run("format.colorScale range=A1:A2");
  eq("Excel's red, yellow, green by default", [(await replay.run("format.rules")).output, again.styleOf("A1")], [["1. A1:A2: colour scale #f8696b, #ffeb84, #63be7b"], "text-align: end; background: #f8696b"]);
}
// expect: ok highlight: a comparison
// expect: ok between, inclusive
// expect: ok text that contains, any case
// expect: ok equal to text, any case
// expect: ok top 2, bottom 20%
// expect: ok above and below average
// expect: ok duplicates and uniques, any case, empty cells left out
// expect: ok a two-colour scale, min to max
// expect: ok three colours: the middle at the median
// expect: ok an icon set: thirds of the range
// expect: ok described
// expect: ok format.highlight, Excel's light red fill by default
// expect: ok a style of one's own, in the app's dialect
// expect: ok an icon set shows in the text
// expect: ok the first rule listed wins
// expect: ok rules follow an edit
// expect: ok format.rules lists them in order
// expect: ok rows inserted move them
// expect: ok saved with the sheet
// expect: ok format.deleteRule, and refusals
// expect: ok format.clearRules: the rules over a range
// expect: ok Excel's red, yellow, green by default
