// Spreadsheet (docs/roadmap.md demo 18), declared as panels over a seam.
//
// site/sheet/ is the spreadsheet with no ui: two formula languages (Excel's,
// and RexxJS's as the Tauri spreadsheet has them), a Sheet that keeps
// who-reads-whom and works out what changed in order, notes and formats,
// and under them all the commands (commands.ts): every action is one, with
// string parameters and a journal, which RexxJS scripts drive through
// ADDRESS SHEET and specs drive headless. site/sheet/view/ is the ui: each
// panel reads the workbook through state and runs commands, and nothing
// else. This page only says which panels, in which order.
import { SheetView } from "./sheet/view/view.ts";
import { languageBar } from "./sheet/view/languagebar.ts";
import { formulaBar } from "./sheet/view/formulabar.ts";
import { notesBar } from "./sheet/view/notesbar.ts";
import { namesBar } from "./sheet/view/namesbar.ts";
import { sheetGrid } from "./sheet/view/grid.ts";
import { editBar } from "./sheet/view/editbar.ts";
import { findBar } from "./sheet/view/findbar.ts";
import { commandBar } from "./sheet/view/commandbar.ts";
import { fileBar } from "./sheet/view/filebar.ts";
import { functionList, problemList, setupScript, statusLine } from "./sheet/view/lists.ts";

const sheet = new SheetView();

ui.text("Spreadsheet");
languageBar(sheet);
formulaBar(sheet);
notesBar(sheet);
namesBar(sheet);
statusLine(sheet);
sheetGrid(sheet);
editBar(sheet);
findBar(sheet);
fileBar(sheet);
commandBar(sheet);
functionList(sheet);
setupScript(sheet);
problemList(sheet);
sheet.refresh();
