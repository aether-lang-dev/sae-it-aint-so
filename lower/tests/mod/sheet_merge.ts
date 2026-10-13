// Merged cells and row heights, now that the datagrid draws them (aether-ui
// 08e3193d): Merge and Merge & Center (the top-left's value kept, the others
// cleared, as Excel warns it does), Unmerge, a merge replacing those it
// overlaps; rows set to a height, or back. Per sheet; moving with inserted
// and deleted rows; saved.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
await cmds.run("cell.set cell=A1 input=Title");
await cmds.run("cell.set cell=B1 input=gone");

eq("cells.merge: one cell over the range, the others cleared", [await message("cells.merge range=A1:C1"), wb.merges(), wb.sheet.input("B1")],
  ["merged A1:C1 (1 cell cleared)", ["A1:C1"], ""]);
eq("Merge & Center centres its value", [await message("cells.merge range=A3:B4 center=1"), wb.styleOf("A3")], ["merged A3:B4", "text-align: center"]);
eq("a merge replaces those it overlaps", [await message("cells.merge range=B1:B3"), wb.merges()], ["merged B1:B3", ["B1:B3"]]);
eq("cells.unmerge: the merges a range touches", [await message("cells.unmerge range=B2"), wb.merges(), await message("cells.unmerge range=B2")], ["unmerged 1", [], "no merge in B2"]);
eq("one cell is no merge", await message("cells.merge range=D4"), "D4 is one cell: nothing to merge");
await cmds.run("cells.merge range=A5:B6");
await cmds.run("rows.insert at=1");
eq("merges move with inserted rows", wb.merges(), ["A6:B7"]);
await cmds.run("rows.delete at=6");
eq("and shrink with deleted ones", wb.merges(), ["A6:B6"]);

eq("rows.height: rows set to a height, or back", [await message("rows.height range=A2:A3 height=40"), wb.rowHeights(), await message("rows.height range=A3 height=0"), wb.rowHeights()],
  ["rows 2 to 3 are 40 high", [[1, 40], [2, 40]], "row 3 is as tall as the grid's", [[1, 40]]]);
eq("a height that is not one", await message("rows.height range=A2 height=-5"), "-5 is not a height (0 for the grid's)");
const read = readSheetFile(JSON.parse(JSON.stringify(writeSheetFile(wb)))).sheets[0];
eq("saved with the sheet", [read.merges, read.view.rowHeights], [["A6:B6"], [[1, 40]]]);
// expect: ok cells.merge: one cell over the range, the others cleared
// expect: ok Merge & Center centres its value
// expect: ok a merge replaces those it overlaps
// expect: ok cells.unmerge: the merges a range touches
// expect: ok one cell is no merge
// expect: ok merges move with inserted rows
// expect: ok and shrink with deleted ones
// expect: ok rows.height: rows set to a height, or back
// expect: ok a height that is not one
// expect: ok saved with the sheet
