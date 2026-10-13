// A cell's look past colour and bold, now that the datagrid draws it
// (aether-ui 08e3193d): italic, underline, strikethrough, a size, borders,
// wrapped text (formats.ts's lookStyle, and the dialects' own words for
// them); the format.font, format.border and format.wrap commands; a
// comment's corner marker and tooltip; data bars as a conditional rule.
import { lookStyle, toStyle } from "./sheet/formats.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { eq } from "./lib/check.ts";

eq("CSS objects (a RexxJS style function's): italic, underline, a size", toStyle({ fontStyle: "italic", textDecoration: "underline", fontSize: "16px" }),
  "font-style: italic; text-decoration: underline; font-size: 16px");
eq("the app's format strings", [toStyle("italic;underline;size:14"), toStyle("strikethrough"), toStyle("wrap")],
  ["font-style: italic; text-decoration: underline; font-size: 14px", "text-decoration: line-through", "white-space: normal"]);
eq("borders, their colours named or not", toStyle("border-bottom: 2px solid red; border: 1px solid #333"), "border-bottom: 2px solid #ff0000; border: 1px solid #333333");
eq("a look as the grid's style", lookStyle({ bold: true, italic: true, underline: true, strike: true, size: 14, wrap: true, borders: { top: "#000000", bottom: "#ff0000" } }),
  "font-weight: bold; font-style: italic; text-decoration: underline line-through; font-size: 14px; white-space: normal; border-top: 1px solid #000000; border-bottom: 1px solid #ff0000");

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
await cmds.run("cell.set cell=A1 input=hello");
eq("format.font: on, then off, a part at a time", [await message("format.font range=A1:B1 italic=1 underline=1 size=14"), wb.styleOf("A1"), await message("format.font range=A1 italic=0"), wb.styleOf("A1")],
  ["A1:B1: italic, underline, size 14", "font-style: italic; text-decoration: underline; font-size: 14px", "A1: not italic", "text-decoration: underline; font-size: 14px"]);
eq("format.border: the outline of a range, or every edge, or none", [await message("format.border range=A1:B2 edge=outline"), wb.styleOf("B2").includes("border-right: 1px solid #000000"), wb.styleOf("B2").includes("border-bottom"),
  wb.styleOf("B2").includes("border-top"), await message("format.border range=A1:B2 edge=none"), wb.styleOf("B2")],
  ["A1:B2: outline borders", true, true, false, "A1:B2: no borders", ""]);
eq("an edge in a colour", [await message("format.border range=C1 edge=bottom color=#ff0000"), wb.styleOf("C1")], ["C1: bottom border", "border-bottom: 1px solid #ff0000"]);
eq("format.wrap", [await message("format.wrap range=A1"), wb.styleOf("A1").includes("white-space: normal"), wb.wrapped()], ["A1: wrapped", true, [0]]);
eq("refusals", [await message("format.border range=A1 edge=diagonal"), await message("format.font range=A1 size=x")],
  ["diagonal is not an edge (outline, all, top, right, bottom, left, none)", "x is not a size"]);
await cmds.run("edit.copy range=A1");
await cmds.run("edit.pasteSpecial at=D4 what=formats");
eq("Paste Special formats takes the look", wb.styleOf("D4"), wb.styleOf("A1"));
await cmds.run("range.clearFormats range=D4");
eq("Clear Formats clears it", wb.styleOf("D4"), "");
eq("a file keeps it", readSheetFile(JSON.parse(JSON.stringify(writeSheetFile(wb)))).sheets[0].notes.get("A1")?.look, wb.notes.get("A1").look);

await cmds.run("cell.comment cell=B3 text=checked");
eq("a comment: a corner marker, and its text to show on hover", [wb.styleOf("B3"), wb.tooltipOf("B3"), wb.tooltipOf("B4")], ["--corner: #d00000", "checked", ""]);

for (let r = 1; r <= 3; r++) await cmds.run(`cell.set cell=E${r} input=${[10, -5, 20][r - 1]}`);
eq("data bars: each a share of the largest, from the end when negative", [await message("format.dataBar range=E1:E3"), wb.styleOf("E1"), wb.styleOf("E2"), wb.styleOf("E3")],
  ["E1:E3: data bars #638ec6", "text-align: end; --fill: 0.5; --fill-color: #638ec6", "text-align: end; --fill: -0.25; --fill-color: #638ec6", "text-align: end; --fill: 1; --fill-color: #638ec6"]);
// expect: ok CSS objects (a RexxJS style function's): italic, underline, a size
// expect: ok the app's format strings
// expect: ok borders, their colours named or not
// expect: ok a look as the grid's style
// expect: ok format.font: on, then off, a part at a time
// expect: ok format.border: the outline of a range, or every edge, or none
// expect: ok an edge in a colour
// expect: ok format.wrap
// expect: ok refusals
// expect: ok Paste Special formats takes the look
// expect: ok Clear Formats clears it
// expect: ok a file keeps it
// expect: ok a comment: a corner marker, and its text to show on hover
// expect: ok data bars: each a share of the largest, from the end when negative
