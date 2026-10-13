// site/sheet/commands.ts and workbook.ts: the seam under the page. Every
// action is a command with an id and string parameters, run on a Workbook;
// what changed comes back as an Outcome; the commands that change the sheet
// are journaled as command lines, which replay. RexxJS scripts drive the same
// commands through ADDRESS SHEET, SETCELL and GETCELL (script.ts).
import { Commands, lineOf, parseLine } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

eq("a command line: an id, then name=value, quoted when it must be", parseLine('cell.set cell=B2 input="=SUM(A1:A3) & ""x"""'),
  { id: "cell.set", params: { cell: "B2", input: '=SUM(A1:A3) & "x"' } });
eq("and back", lineOf("cell.set", { cell: "B2", input: '=A1 & "x y"' }), 'cell.set cell=B2 input="=A1 & ""x y"""');
eq("a bare value needs no quotes", lineOf("rows.insert", { at: "5", count: "2" }), "rows.insert at=5 count=2");

const wb = new Workbook();
const cmds = new Commands(wb);
const value = (k: string) => show(wb.sheet.value(k));
const outcome = async (line: string) => {
  const o = await cmds.run(line);
  return `${o.ok ? "ok" : "refused"}: ${o.message}`;
};

eq("the catalogue: every command, with its label and parameters", cmds.catalogue("sort").map((c) => `${c.id} (${c.params})`),
  ["data.sortAscending (range, by)", "data.sortDescending (range, by)", "table.sort (name, column)"]);
eq("cell.set", [await outcome("cell.set cell=A1 input=2"), await outcome('cell.set cell=B1 input="=A1*10"'), value("B1")], ["ok: A1 = 2", "ok: B1 = 20", "20"]);
eq("what changed comes back, for the view to redraw", (await cmds.run("cell.set cell=A1 input=3")).changed, ["A1", "B1"]);
eq("cell.get reads, and is not journaled", [await outcome("cell.get cell=B1"), (await cmds.run("cell.get cell=B1")).output], ["ok: B1 = 30", "30"]);
eq("refusals: no such command, a parameter missing, a cell off the sheet", [await outcome("cell.paint cell=A1"), await outcome("cell.set cell=A1"), await outcome("cell.set cell=Z99 input=1")],
  ["refused: no command cell.paint", "refused: cell.set needs input", "refused: Z99 is not a cell on the sheet"]);
eq("the journal: what changed the sheet, as command lines", cmds.journal(), ["cell.set cell=A1 input=2", 'cell.set cell=B1 input="=A1*10"', "cell.set cell=A1 input=3"]);

await cmds.run("range.clear range=A1:B1");
eq("range.clear", [value("A1"), value("B1")], ["", ""]);
await cmds.run("edit.undo");
eq("edit.undo, edit.redo", [value("B1"), (await cmds.run("edit.redo")).message, value("B1")], ["30", "redo: 2 changed", ""]);
await cmds.run("edit.undo");

await cmds.run('cell.set cell=C1 input="=A1+B1"');
await cmds.run("edit.copy range=C1");
eq("edit.copy and edit.paste: a formula moves", [(await cmds.run("edit.paste at=C2")).message, wb.sheet.input("C2")], ["pasted at C2: 1 cells set, 1 changed", "=A2+B2"]);
await cmds.run("cell.set cell=A2 input=1");
await cmds.run("cell.set cell=A3 input=2");
await cmds.run('cell.set cell=B2 input="=A2*2"');
eq("edit.fillDown", [(await cmds.run("edit.fillDown range=B2:B3")).message, wb.sheet.input("B3"), value("B3")], ["filled B2:B3 down: 1 cells set, 1 changed", "=A3*2", "4"]);

await cmds.run("cell.comment cell=A1 text=start");
await cmds.run('cell.format cell=B1 format="0.00"');
eq("notes: a comment, a format", [wb.notes.get("A1").comment, wb.textOf("B1")], ["start", "30.00"]);

eq("rows.insert moves cells and notes", [(await cmds.run("rows.insert at=1")).message, value("B2"), wb.notes.get("A2").comment], ["inserted 1 row at 1: 11 cells set, 11 changed", "30", "start"]);
await cmds.run("rows.delete at=1");
eq("rows.delete takes it back", [value("B1"), wb.notes.get("A1").comment], ["30", "start"]);

eq("data.sortDescending, by a column", [(await cmds.run("data.sortDescending range=A1:B3 by=A")).message, value("A1"), value("A3")],
  ["sorted A1:B3 by A, descending: 6 cells set, 7 changed", "3", "1"]);
eq("edit.find gives what it found", (await cmds.run("edit.find text=2")).output, ["A2", "B3"]);
eq("edit.replace", [(await cmds.run("edit.replace text=start with=begin")).message, wb.notes.get("A1").comment, value("A1")], ["replaced start: 0 cells set, 0 changed", "start", "3"]);

eq("formulas.use: the major setting", [(await cmds.run("formulas.use language=RexxJS")).message, wb.sheet.language.name], ["RexxJS formulas", "RexxJS"]);
eq("file.open a sample", [(await cmds.run("file.open sample=budget")).message, value("C2"), wb.setupScript.split("\n")[1]],
  ["opened Sample Budget: 20 cells, RexxJS formulas", "96", "LET TAX_RATE = 0.08"]);

{
  const again = new Workbook();
  const replay = new Commands(again);
  for (const line of cmds.journal()) await replay.run(line);
  eq("the journal replays to the same sheet", ["A1", "B2", "C2", "D6"].map((k) => show(again.sheet.value(k))), ["Item", "1200", "96", "1404"]);
}

{
  const said: string[] = [];
  const out = await cmds.script(`
    ADDRESS SHEET "cell.set cell=E1 input=7"
    SAY "set E1, rc" RC
    LET r = SETCELL("E2", "=E1 * 6")
    SAY "E2 is" GETCELL("E2")
    ADDRESS SHEET "rows.delete at=99"
    SAY "off the sheet, rc" RC
    ADDRESS SHEET "cell.get cell=D6"
    SAY "D6 is" RESULT
  `, (line) => said.push(line));
  eq("a RexxJS script drives the sheet: ADDRESS SHEET, SETCELL, GETCELL, RC and RESULT", [said, out.ok, value("E2")],
    [["set E1, rc 0", "E2 is 42", "off the sheet, rc 1", "D6 is 1404"], true, "42"]);
  eq("its changes are journaled as the commands they ran", cmds.journal().slice(-2), ["cell.set cell=E1 input=7", 'cell.set cell=E2 input="=E1 * 6"']);
  const one: string[] = [];
  await cmds.script(`ADDRESS SHEET "cell.set cell=E3 input=1"; SAY "a;b" GETCELL("E3")`, (line) => one.push(line));
  eq("a ';' ends a clause, as in Rexx, but not in a string", one, ["a;b 1"]);
  eq("a script that fails says why", (await cmds.script("LET x = 1/0", () => {})).message, "Division by zero");
}
await cmds.run('cell.set cell=F1 input="=SETCELL(""A1"", 9)"');
eq("a formula cannot change the sheet", [value("F1"), wb.sheet.value("F1") && String((wb.sheet.value("F1") as any).why)], ["#ERROR!", "SETCELL changes the sheet: run it in a script, not a formula"]);
// expect: ok a command line: an id, then name=value, quoted when it must be
// expect: ok and back
// expect: ok a bare value needs no quotes
// expect: ok the catalogue: every command, with its label and parameters
// expect: ok cell.set
// expect: ok what changed comes back, for the view to redraw
// expect: ok cell.get reads, and is not journaled
// expect: ok refusals: no such command, a parameter missing, a cell off the sheet
// expect: ok the journal: what changed the sheet, as command lines
// expect: ok range.clear
// expect: ok edit.undo, edit.redo
// expect: ok edit.copy and edit.paste: a formula moves
// expect: ok edit.fillDown
// expect: ok notes: a comment, a format
// expect: ok rows.insert moves cells and notes
// expect: ok rows.delete takes it back
// expect: ok data.sortDescending, by a column
// expect: ok edit.find gives what it found
// expect: ok edit.replace
// expect: ok formulas.use: the major setting
// expect: ok file.open a sample
// expect: ok the journal replays to the same sheet
// expect: ok a RexxJS script drives the sheet: ADDRESS SHEET, SETCELL, GETCELL, RC and RESULT
// expect: ok its changes are journaled as the commands they ran
// expect: ok a ';' ends a clause, as in Rexx, but not in a string
// expect: ok a script that fails says why
// expect: ok a formula cannot change the sheet
