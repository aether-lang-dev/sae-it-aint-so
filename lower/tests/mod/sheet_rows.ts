// Rows and columns out of view, now that the datagrid hides them (aether-ui
// 08e3193d): Hide and Unhide, AutoFilter (the rows of a table whose value in
// a column fails a criterion, as COUNTIF writes one), and Freeze Top Row.
// Per sheet; hidden rows move with inserted and deleted rows; saved.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;

eq("rows.hide and rows.unhide, by the rows a range covers", [await message("rows.hide range=A2:C3"), wb.hidden(), await message("rows.unhide range=A3"), wb.hidden()],
  ["hid rows 2 to 3", { rows: [1, 2], cols: [] }, "showed row 3", { rows: [1], cols: [] }]);
eq("columns too", [await message("columns.hide range=B1:C1"), wb.hidden().cols, await message("columns.unhide range=A1:Z1"), wb.hidden().cols],
  ["hid columns B to C", [1, 2], "showed columns A to Z", []]);
await cmds.run("rows.insert at=1");
eq("hidden rows move with inserted ones", wb.hidden().rows, [2]);
await cmds.run("rows.delete at=3");
eq("and go with deleted ones", wb.hidden().rows, []);

for (const [k, v] of [["A1", "region"], ["B1", "sales"], ["A2", "North"], ["B2", "100"], ["A3", "South"], ["B3", "250"], ["A4", "East"], ["B4", "50"], ["A5", "West"], ["B5", "175"]]) await cmds.run(`cell.set cell=${k} input=${v}`);
eq("AutoFilter: a table's rows whose column fails the criterion hidden; its header row kept", [await message('data.filter range=A1:B5 column=B criterion=">100"'), wb.hidden().rows],
  ["filtered A1:B5 by B >100: 2 rows hidden", [1, 3]]);
eq("a text criterion, any case", [await message("data.filter range=A1:B5 column=A criterion=north"), wb.hidden().rows], ["filtered A1:B5 by A north: 3 rows hidden", [2, 3, 4]]);
eq("a filter's rows are its own: hiding by hand stays", [(await cmds.run("rows.hide range=A7")) && await message("data.clearFilter"), wb.hidden().rows], ["filter cleared: 3 rows shown", [6]]);
eq("refusals", [await message("data.filter range=A1:B5 column=D criterion=1"), await message("data.clearFilter"), await message("rows.hide range=AA9")],
  ["D is not a column of A1:B5", "no filter", "AA9 is not a range on the sheet"]);

eq("view.freezeRows", [await message("view.freezeRows count=1"), wb.frozenRows(), await message("view.freezeRows count=0"), wb.frozenRows()], ["froze 1 row", 1, "unfroze rows", 0]);
await cmds.run("view.freezeRows count=2");
await cmds.run("sheet.add name=Other");
eq("each sheet its own", [wb.hidden(), wb.frozenRows()], [{ rows: [], cols: [] }, 0]);
await cmds.run("sheet.activate name=Sheet1");
const read = readSheetFile(JSON.parse(JSON.stringify(writeSheetFile(wb))));
eq("saved with the sheet", [read.sheets[0].view], [{ hiddenRows: [6], hiddenCols: [], frozenRows: 2, rowHeights: [], colWidths: [], filter: null }]);
// expect: ok rows.hide and rows.unhide, by the rows a range covers
// expect: ok columns too
// expect: ok hidden rows move with inserted ones
// expect: ok and go with deleted ones
// expect: ok AutoFilter: a table's rows whose column fails the criterion hidden; its header row kept
// expect: ok a text criterion, any case
// expect: ok a filter's rows are its own: hiding by hand stays
// expect: ok refusals
// expect: ok view.freezeRows
// expect: ok each sheet its own
// expect: ok saved with the sheet
