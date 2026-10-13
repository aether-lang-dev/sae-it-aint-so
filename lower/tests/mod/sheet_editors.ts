// Cell editors (site/sheet/editors.ts), the Tauri spreadsheet's
// SETCELLEDITOR: a checkbox, a dropdown, a date. First the editor alone,
// then through the commands: drawn, toggled, held to its choices, moved
// with its cell and saved.
import { asApp, checked, drawn, editorIn, editorOf, refusal, toggled } from "./sheet/editors.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { CellError } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const err = (f: () => unknown) => {
  try {
    return f();
  } catch (e) {
    return (e as Error).message;
  }
};
eq("editorOf: the three kinds, a dropdown's options trimmed; what is not one", [
  editorOf("Checkbox"), editorOf("dropdown", " Red, Green ,,Blue"), editorOf("date", undefined, "YYYY-MM-DD"), err(() => editorOf("slider")), err(() => editorOf("dropdown", " , ")),
], [{ kind: "checkbox" }, { kind: "dropdown", options: ["Red", "Green", "Blue"] }, { kind: "date", format: "YYYY-MM-DD" }, "slider is not an editor (checkbox, dropdown, date)", "a dropdown needs options"]);
const box = editorOf("checkbox"), menu = editorOf("dropdown", "Red,Green"), day = editorOf("date");
eq("refusal: what each takes; empty and a formula always", [
  refusal(box, "true"), refusal(box, "yes"), refusal(menu, "Green"), refusal(menu, "green"), refusal(day, "2026-02-28"), refusal(day, "2026-02-30"), refusal(day, "today"), refusal(menu, ""), refusal(box, "=A1>2"),
], [null, "is a checkbox: TRUE or FALSE", null, "is one of Red, Green", null, "is a date: YYYY-MM-DD", "is a date: YYYY-MM-DD", null, null]);
eq("a checkbox: ticked by TRUE, 1 or the text; drawn as its box; toggled", [
  checked(true), checked(1), checked("true"), checked(false), checked(new CellError("#N/A")), drawn(box, true, "TRUE"), drawn(box, null, ""), drawn(menu, "Red", "Red"), toggled(true), toggled(null),
], [true, true, true, false, false, "☑", "☐", "Red", "FALSE", "TRUE"]);
eq("as the app's GETCELLEDITOR gives it, and read back from a file", [asApp(menu), asApp(day), asApp(box), editorIn({ kind: "dropdown", options: ["a"] }), editorIn({ kind: "nope" }), editorIn("x")],
  [{ type: "dropdown", config: { options: ["Red", "Green"] } }, { type: "date", config: {} }, { type: "checkbox", config: {} }, { kind: "dropdown", options: ["a"] }, undefined, undefined]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
eq("cell.editor: a checkbox drawn ☐, then ☑ when toggled", [await message("cell.editor cell=B2 kind=checkbox"), wb.textOf("B2"), await message("cell.toggle cell=B2"), wb.textOf("B2"), wb.sheet.input("B2")],
  ["B2 is a checkbox", "☐", "B2 = TRUE", "☑", "TRUE"]);
eq("what is typed into one is held to it", [await message("cell.set cell=B2 input=maybe"), await message("cell.set cell=B2 input=false"), wb.textOf("B2")],
  ["B2 is a checkbox: TRUE or FALSE", "B2 = false", "☐"]);
await cmds.run("cell.editor cell=C2 kind=dropdown options=Red,Green");
await cmds.run("cell.editor cell=D2 kind=date");
eq("a dropdown's options, a date", [await message("cell.set cell=C2 input=Blue"), await message("cell.set cell=C2 input=Red"), await message("cell.set cell=D2 input=2026-13-01"), await message("cell.set cell=D2 input=2026-10-13")],
  ["C2 is one of Red, Green", "C2 = Red", "D2 is a date: YYYY-MM-DD", "D2 = 2026-10-13"]);
eq("refusals: no such editor, a toggle on what is not a checkbox, none to take away", [await message("cell.editor cell=E2 kind=slider"), await message("cell.toggle cell=C2"), await message("cell.editor cell=E2 kind=none")],
  ["slider is not an editor (checkbox, dropdown, date)", "C2 is not a checkbox", "E2 has no editor"]);
eq("cell.about gives it as the app does", (await cmds.run("cell.about cell=C2")).output!.editor, { type: "dropdown", config: { options: ["Red", "Green"] } });
await cmds.run("rows.insert at=1");
eq("it moves with its cell", [wb.notes.get("B3").editor, wb.textOf("B3"), wb.notes.get("B2").editor], [{ kind: "checkbox" }, "☐", undefined]);
const read = readSheetFile(JSON.parse(JSON.stringify(writeSheetFile(wb))));
eq("saved with the cell, and read back", [read.sheets[0].notes.get("C3")!.editor, read.sheets[0].notes.get("D3")!.editor], [{ kind: "dropdown", options: ["Red", "Green"] }, { kind: "date" }]);
eq("kind=none takes it away", [await message("cell.editor cell=C3 kind=none"), await message("cell.set cell=C3 input=Blue")], ["C3 has no editor", "C3 = Blue"]);
// expect: ok editorOf: the three kinds, a dropdown's options trimmed; what is not one
// expect: ok refusal: what each takes; empty and a formula always
// expect: ok a checkbox: ticked by TRUE, 1 or the text; drawn as its box; toggled
// expect: ok as the app's GETCELLEDITOR gives it, and read back from a file
// expect: ok cell.editor: a checkbox drawn ☐, then ☑ when toggled
// expect: ok what is typed into one is held to it
// expect: ok a dropdown's options, a date
// expect: ok refusals: no such editor, a toggle on what is not a checkbox, none to take away
// expect: ok cell.about gives it as the app does
// expect: ok it moves with its cell
// expect: ok saved with the cell, and read back
// expect: ok kind=none takes it away
