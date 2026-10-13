// Several sheets in a workbook: added, activated, deleted by command; a
// formula reads another sheet's cells (Costs!B2, 'My Costs'!B2,
// SUM(Costs!B1:B3) in Excel formulas; Costs_B2 and "Costs!B1:B3" in RexxJS
// ones, as the Tauri app has them), and follows them when they change.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { EXCEL } from "./sheet/excel.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { eq } from "./lib/check.ts";

const wb = new Workbook();
const cmds = new Commands(wb);
const value = (k: string) => show(wb.sheet.value(k));
const message = async (line: string) => (await cmds.run(line)).message;

eq("a workbook starts with one sheet", [wb.sheetNames(), wb.active], [["Sheet1"], "Sheet1"]);
eq("sheet.add adds one and makes it the active one", [await message("sheet.add name=Costs"), wb.sheetNames(), wb.active], ["added Costs", ["Sheet1", "Costs"], "Costs"]);
await cmds.run("cell.set cell=B1 input=1");
await cmds.run("cell.set cell=B2 input=2");
await cmds.run("cell.set cell=B3 input=3");
eq("sheet.activate", [await message("sheet.activate name=sheet1"), value("B2")], ["Sheet1", ""]);
await cmds.run('cell.set cell=A1 input="=Costs!B2*2"');
await cmds.run('cell.set cell=A2 input="=SUM(costs!B1:B3)"');
await cmds.run(`cell.set cell=A3 input="='Costs'!B3"`);
eq("an Excel formula reads another sheet: a cell, a range, a quoted name", [value("A1"), value("A2"), value("A3")], ["4", "6", "3"]);
await cmds.run("sheet.activate name=Costs");
await cmds.run("cell.set cell=B2 input=10");
await cmds.run("sheet.activate name=Sheet1");
eq("and follows it when it changes", [value("A1"), value("A2")], ["20", "14"]);
await cmds.run('cell.set cell=A4 input="=Nope!A1"');
eq("a sheet that is not there is #REF!", [value("A4"), String((wb.sheet.value("A4") as any).why)], ["#REF!", "no sheet NOPE"]);
await cmds.run("edit.copy range=A1");
await cmds.run("edit.paste at=A5");
eq("a copy moves a reference to another sheet as any other", wb.sheet.input("A5"), "=Costs!B6*2");
await cmds.run("rows.insert at=1");
eq("rows inserted here leave references to another sheet alone", [wb.sheet.input("A2"), value("A2")], ["=Costs!B2*2", "20"]);
await cmds.run("rows.delete at=1");

await cmds.run("formulas.use language=RexxJS");
await cmds.run('cell.set cell=A9 input="=Costs_B2 + SUM_RANGE(""Costs!B1:B3"")"');
eq("RexxJS formulas: Costs_B2, and a range function over another sheet", value("A9"), "24");
await cmds.run("sheet.activate name=Costs");
await cmds.run("cell.set cell=B1 input=5");
await cmds.run("sheet.activate name=Sheet1");
eq("and follow it", value("A9"), "28");
eq("every sheet speaks the workbook's language", (await cmds.run("sheet.activate name=Costs")) && wb.sheet.language.name, "RexxJS");
await cmds.run("sheet.activate name=Sheet1");
await cmds.run("formulas.use language=Excel");
await cmds.run("sheet.activate name=Costs");
eq("rows inserted on another sheet move the references to it", [await message("rows.insert at=1"), await message("sheet.activate name=Sheet1"), wb.sheet.input("A1"), value("A1")],
  ["inserted 1 row at 1: 4 cells set, 4 changed", "Sheet1", "=Costs!B3*2", "20"]);
await cmds.run("sheet.activate name=Costs");
await cmds.run("rows.delete at=1");
await cmds.run("sheet.activate name=Sheet1");

eq("refusals: a name taken, a sheet not there, the last sheet", [
  await message("sheet.add name=costs"), await message("sheet.activate name=Budget"), await message("sheet.add name=a!b"),
], ["costs is a sheet already", "no sheet Budget", "a!b is not a sheet name: letters, digits, spaces or _"]);
eq("sheet.delete: what read it is #REF!", [await message("sheet.delete name=Costs"), wb.sheetNames(), value("A1")], ["deleted Costs", ["Sheet1"], "#REF!"]);
eq("the last sheet stays", await message("sheet.delete name=Sheet1"), "Sheet1 is the only sheet");
{
  const again = new Workbook();
  const replay = new Commands(again);
  for (const line of cmds.journal()) await replay.run(line);
  eq("the journal replays to the same workbook", [again.sheetNames(), show(again.sheet.value("A1")), show(again.sheet.value("A5"))], [["Sheet1"], "#REF!", "#REF!"]);
}

// Renaming a sheet: each language rewrites what names it, and only that.
eq("Excel: references to the sheet, quoted or not, in ranges too, renamed; text and other sheets stay",
  EXCEL.renamed(`=Costs!B2*2+'costs'!$B$3+SUM(Costs!B1:B3)&"Costs!B2"+Other!A1`, "COSTS", "My Costs"),
  `='My Costs'!B2*2+'My Costs'!$B$3+SUM('My Costs'!B1:B3)&"Costs!B2"+Other!A1`);
const rx = new RexxLanguage();
eq("RexxJS: Costs_B2 and \"Costs!B1:B3\" renamed; a name with a space cannot be a variable's",
  [rx.renamed('=Costs_B2 + SUM_RANGE("Costs!B1:B3") + costs_B1 + Other_A1', "COSTS", "Spend"), rx.renamed('=SUM_RANGE("Costs!B1:B3")', "COSTS", "My Costs"), rx.renamed("=Costs_B2", "COSTS", "My Costs")],
  ['=Spend_B2 + SUM_RANGE("Spend!B1:B3") + Spend_B1 + Other_A1', `=SUM_RANGE("'My Costs'!B1:B3")`, null]);
{
  const w = new Workbook();
  const c = new Commands(w);
  await c.run("sheet.add name=Costs");
  await c.run("cell.set cell=B2 input=5");
  await c.run("sheet.activate name=Sheet1");
  await c.run(`cell.set cell=A1 input="=Costs!B2*2"`);
  eq("sheet.rename: what read the sheet reads it by its new name", [(await c.run("sheet.rename name=costs to=Spend")).message, w.sheetNames(), w.sheet.input("A1"), show(w.sheet.value("A1"))],
    ["Costs is now Spend", ["Sheet1", "Spend"], "=Spend!B2*2", "10"]);
  await c.run("sheet.activate name=Spend");
  await c.run("cell.set cell=B2 input=7");
  await c.run("sheet.activate name=Sheet1");
  eq("and follows it", show(w.sheet.value("A1")), "14");
  await c.run("formulas.use language=RexxJS");
  await c.run(`cell.set cell=A2 input="=Spend_B2 + 1"`);
  eq("refusals: a name taken, not a name, a RexxJS variable that cannot be written; nothing changed", [
    (await c.run("sheet.rename name=Spend to=sheet1")).message, (await c.run("sheet.rename name=Spend to=a!b")).message,
    (await c.run("sheet.rename name=Spend to=\"My Spend\"")).message, w.sheetNames(), w.sheet.input("A1"),
  ], ["sheet1 is a sheet already", "a!b is not a sheet name: letters, digits, spaces or _", "Sheet1!A2 reads Spend as RexxJS writes it, and My Spend cannot be written so", ["Sheet1", "Spend"], "=Spend!B2*2"]);
}
// expect: ok a workbook starts with one sheet
// expect: ok sheet.add adds one and makes it the active one
// expect: ok sheet.activate
// expect: ok an Excel formula reads another sheet: a cell, a range, a quoted name
// expect: ok and follows it when it changes
// expect: ok a sheet that is not there is #REF!
// expect: ok a copy moves a reference to another sheet as any other
// expect: ok rows inserted here leave references to another sheet alone
// expect: ok RexxJS formulas: Costs_B2, and a range function over another sheet
// expect: ok and follow it
// expect: ok every sheet speaks the workbook's language
// expect: ok rows inserted on another sheet move the references to it
// expect: ok refusals: a name taken, a sheet not there, the last sheet
// expect: ok sheet.delete: what read it is #REF!
// expect: ok the last sheet stays
// expect: ok the journal replays to the same workbook
// expect: ok Excel: references to the sheet, quoted or not, in ranges too, renamed; text and other sheets stay
// expect: ok RexxJS: Costs_B2 and "Costs!B1:B3" renamed; a name with a space cannot be a variable's
// expect: ok sheet.rename: what read the sheet reads it by its new name
// expect: ok and follows it
// expect: ok refusals: a name taken, not a name, a RexxJS variable that cannot be written; nothing changed
