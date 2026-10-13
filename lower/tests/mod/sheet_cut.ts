// site/sheet/commands.ts: Cut, and Paste over a selection. A paste into a
// range as many times the copy's size each way fills each part of it (a
// cell copied into every cell); otherwise it lands once, at the range's
// first cell. Cut and paste moves cells, as a spreadsheet does: what reads
// them follows, here and on other sheets; what was under them is gone, and
// what read that is #REF!; their notes go with them; one undo.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const input = (...keys: string[]) => keys.map((k) => wb.sheet.input(k));
const shown = (...keys: string[]) => keys.map((k) => show(wb.sheet.value(k)));
const message = async (line: string) => (await cmds.run(line)).message;

// Paste over a selection.
await cmds.run("cell.set cell=A1 input=1");
await cmds.run('cell.set cell=B1 input="=A1*2"');
await cmds.run("edit.copy range=B1");
eq("a cell copied into a range fills each cell, its formula moved", [await message("edit.paste at=D1:E2"), input("D1", "E1", "D2", "E2")],
  ["pasted into D1:E2: 4 cells set, 4 changed", ["=C1*2", "=D1*2", "=C2*2", "=D2*2"]]);
await cmds.run("edit.copy range=A1:B1");
eq("two cells into four rows of two: each row", [await message("edit.paste at=A10:B13"), input("A10", "B10", "A13", "B13")],
  ["pasted into A10:B13: 8 cells set, 8 changed", ["1", "=A10*2", "1", "=A13*2"]]);
eq("a range that is not a multiple of the copy: once, at its first cell", [await message("edit.paste at=A20:C20"), input("A20", "B20", "C20")],
  ["pasted at A20: 2 cells set, 2 changed", ["1", "=A20*2", ""]]);

// Cut and paste.
const fresh = async () => {
  await cmds.run("file.new");
  await cmds.run("cell.set cell=A1 input=1");
  await cmds.run("cell.set cell=A2 input=2");
  await cmds.run('cell.set cell=A3 input="=A1+A2"');
  await cmds.run('cell.set cell=B5 input="=A3*10"');
  await cmds.run('cell.set cell=B6 input="=$A$1+SUM(A1:A3)+SUM(A1:A4)"');
  await cmds.run("cell.set cell=C2 input=old");
  await cmds.run('cell.set cell=D9 input="=C2"');
  await cmds.run("cell.comment cell=A1 text=first");
  await cmds.run("sheet.add name=Costs");
  await cmds.run('cell.set cell=B1 input="=Sheet1!A3+1"');
  await cmds.run("sheet.activate name=Sheet1");
};
await fresh();
eq("cut marks it, and changes nothing yet", [await message("edit.cut range=A1:A3"), input("A1", "A3")], ["cut A1:A3", ["1", "=A1+A2"]]);
const moved = await message("edit.paste at=C1");
eq("pasted, the cells move: their formulas read the cells that moved with them", [moved, input("A1", "A2", "A3", "C1", "C2", "C3"), shown("C3")],
  ["moved A1:A3 to C1: 9 cells set, 9 changed", ["", "", "", "1", "2", "=C1+C2"], ["3"]]);
eq("what reads them follows, $ or not; a range wholly in the cut moves, one only partly in it stays", input("B5", "B6"),
  ["=C3*10", "=$C$1+SUM(C1:C3)+SUM(A1:A4)"]);
eq("what read the cell it landed on is #REF!", [input("D9"), shown("D9")], [["=#REF!"], ["#REF!"]]);
eq("another sheet's references follow too", [wb.page("Costs")!.sheet.input("B1"), show(wb.page("Costs")!.sheet.value("B1"))], ["=Sheet1!C3+1", "4"]);
eq("its notes go with it", [wb.notes.get("A1").comment ?? "", wb.notes.get("C1").comment ?? ""], ["", "first"]);
eq("and the cut is used up", await message("edit.paste at=E1"), "nothing copied");
await cmds.run("edit.undo");
eq("one undo puts everything back", [input("A1", "A3", "C2", "B5", "D9"), wb.page("Costs")!.sheet.input("B1"), wb.notes.get("A1").comment],
  [["1", "=A1+A2", "old", "=A3*10", "=C2"], "=Sheet1!A3+1", "first"]);

eq("a cut that would leave the sheet is refused", [await message("edit.cut range=A1:A3"), await message("edit.paste at=Z99")],
  ["cut A1:A3", "A1:A3 moved to Z99 does not fit on the sheet"]);
await cmds.run("sheet.activate name=Costs");
eq("as is one pasted on another sheet", await message("edit.paste at=A1"), "cut cells are pasted on the sheet they were cut from, Sheet1");
await cmds.run("sheet.activate name=Sheet1");
eq("a move that overlaps itself", [await message("edit.paste at=A2"), input("A2", "A3", "A4", "B5")], ["moved A1:A3 to A2: 6 cells set, 6 changed", ["1", "2", "=A2+A3", "=A4*10"]]);

// expect: ok a cell copied into a range fills each cell, its formula moved
// expect: ok two cells into four rows of two: each row
// expect: ok a range that is not a multiple of the copy: once, at its first cell
// expect: ok cut marks it, and changes nothing yet
// expect: ok pasted, the cells move: their formulas read the cells that moved with them
// expect: ok what reads them follows, $ or not; a range wholly in the cut moves, one only partly in it stays
// expect: ok what read the cell it landed on is #REF!
// expect: ok another sheet's references follow too
// expect: ok its notes go with it
// expect: ok and the cut is used up
// expect: ok one undo puts everything back
// expect: ok a cut that would leave the sheet is refused
// expect: ok as is one pasted on another sheet
// expect: ok a move that overlaps itself
