// Named ranges: a name for a cell or a range, in both languages, defined and
// deleted by command. A formula that reads a name reads its cells, and
// follows them when the name is redefined.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const value = (k: string) => show(wb.sheet.value(k));
const message = async (line: string) => (await cmds.run(line)).message;

await cmds.run("example.paste");
eq("names.define: a range, and a cell", [await message("names.define name=qty range=B2:B4"), await message("names.define name=Rate range=C2")],
  ["QTY is Sheet1!B2:B4", "RATE is Sheet1!C2"]);
eq("names are any case, kept upper; the workbook's, by their sheet", wb.names(), [["QTY", "Sheet1!B2:B4"], ["RATE", "Sheet1!C2"]]);
await cmds.run('cell.set cell=F1 input="=SUM(qty)"');
await cmds.run('cell.set cell=F2 input="=rate*100"');
eq("an Excel formula reads a name as its range or cell", [value("F1"), value("F2")], ["9", "45"]);
await cmds.run("cell.set cell=B3 input=11");
eq("and follows its cells", value("F1"), "19");
await cmds.run("names.define name=qty range=B2:B3");
eq("a name redefined: what reads it follows", value("F1"), "17");
eq("refusals: a cell's name, a function's, TRUE, a bad range", [
  await message("names.define name=A1 range=B2"), await message("names.define name=2x range=B2"), await message("names.define name=TRUE range=B2"), await message("names.define name=x range=AA99"),
], ["A1 is a cell, not a name", "2x is not a name: a letter first, then letters, digits or _", "TRUE is not a name: a letter first, then letters, digits or _", "AA99 is not a range on the sheet"]);
await cmds.run("names.delete name=rate");
eq("names.delete: what read it is #NAME?", [value("F2"), String((wb.sheet.value("F2") as any).why)], ["#NAME?", "no name RATE"]);
await cmds.run("names.define name=rate range=C3");
eq("and comes back when defined again", value("F2"), "220");
eq("names.list", (await cmds.run("names.list")).output, ["QTY Sheet1!B2:B3", "RATE Sheet1!C3"]);

await cmds.run("formulas.use language=RexxJS");
await cmds.run('cell.set cell=F3 input="=SUM_RANGE(""qty"") + rate"');
eq("RexxJS formulas: a range function takes a name, a name is its cell", value("F3"), "19.2");
await cmds.run("cell.set cell=C3 input=5");
eq("and follows it", value("F3"), "22");
eq("names are journaled, and replay", cmds.journal().filter((l) => l.startsWith("names.")),
  ["names.define name=qty range=B2:B4", "names.define name=Rate range=C2", "names.define name=qty range=B2:B3", "names.delete name=rate", "names.define name=rate range=C3"]);
// expect: ok names.define: a range, and a cell
// expect: ok names are any case, kept upper; the workbook's, by their sheet
// expect: ok an Excel formula reads a name as its range or cell
// expect: ok and follows its cells
// expect: ok a name redefined: what reads it follows
// expect: ok refusals: a cell's name, a function's, TRUE, a bad range
// expect: ok names.delete: what read it is #NAME?
// expect: ok and comes back when defined again
// expect: ok names.list
// expect: ok RexxJS formulas: a range function takes a name, a name is its cell
// expect: ok and follows it
// expect: ok names are journaled, and replay
