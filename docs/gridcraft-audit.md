# GridCraft: what demo 18 could take from it

[GridCraft](https://github.com/storytold/gridcraft) (storytold, at `fc45b7f`,
release 0.6.1, audited 2026-10-12) is a clean-room reimplementation of Excel
in Rust: about 121,000 lines, an egui desktop app, a WebAssembly build, a
CLI and an MCP server. It is MIT OR Apache-2.0, but it lives under
`not-ours/`: its features are ideas to envy, and demo 18 builds each its own
way. None of its code is copied, ported or paraphrased, whatever the
licence allows. Its catalogue
claims 274 of Excel's 290 ribbon commands and 513 of 523 worksheet functions
(`docs/parity-checklist.md`, `docs/function-parity.md` there), and about
50% readiness "weighted by what Excel users rely on".

Demo 18 (`docs/spreadsheet_demo_done_and_todo.md`) is far smaller: a
10 x 20 sheet on `ui.datagrid`, Excel or RexxJS formulas, the Tauri
spreadsheet's features coming over. This audit sorts GridCraft's features by
what they would take here: ideas worth having first, then features the page
can do today, then ones that need aether-ui, then ones that do not fit.

## Ideas worth taking before features

1. **Everything is a command.** Every ribbon button, menu item, keystroke
   and dialog in GridCraft is a named engine command (`home.bold`,
   `data.sortAscending`, `cell.set`) with documented parameters, a label,
   a shortcut and an enabled state, and every command run is journaled
   (replayable). The UI, the CLI, the MCP server and its JSON control
   channel all run the same commands (`docs/control-protocol.md`:
   `engine.execute`, `engine.commands`, `engine.journal`).

   For demo 18 this is one module, `site/sheet/commands.ts`: the page's
   buttons and keys call commands rather than functions; undo labels come
   from them; a spec can drive the sheet by command instead of by pointer;
   and RexxJS gets the whole catalogue at once, as an `ADDRESS SHEET`
   environment (`ADDRESS SHEET "sort.ascending range=F4:G7"`) and as the
   Tauri app's control functions (SETCELL, GETCELL). That is the Tauri
   app's control bus and GridCraft's agent channel in one design, and the
   ARexx idea RexxJS comes from. It would come before the remaining
   features, since each would then land as a command.
2. **A formula printer.** GridCraft's `formula` crate parses, prints and
   adjusts references (`crates/formula`). Demo 18 rewrites references
   token by token instead (`excel.ts`'s `rewrite`), which keeps a formula as
   typed; a printer would add normalising (`=sum(a1:b2)` to
   `=SUM(A1:B2)`), Show Formulas, and Evaluate Formula's step-by-step view.
3. **Excel's number-format language** (`crates/numfmt`): sections for
   positive, negative, zero and text (`#,##0;[Red](#,##0);"-"`), colours,
   literals, fractions, dates and times. Demo 18's `formats.ts` reads the
   simple cases; this is the whole of it, and is self-contained work.
4. **Copy-on-write snapshots** make undo nearly free there. Taken
   (2026-10-13): demo 18 saves the workbook before each command, each
   container copied and its contents shared, and undo covers everything
   (`docs/spreadsheet_demo_done_and_todo.md`, To do 4).
5. **Enforced layering** (`cargo xtask layers`): sae already does this for
   its services (`tests/check_layers.sh`); `site/sheet/`'s rule, that no
   module but the page touches `ui`, could be checked the same way.

## Features the page can do today

Model work in `site/sheet/` with its checks headless, then the page and an
`it` in `spec_sheet`, as everything so far has gone. Roughly in order of
value for effort:

| Feature | GridCraft command | Notes for demo 18 |
|---|---|---|
| Named ranges, Name Box | `formulas.defineName`, Name Manager | Already next on the list; the cell field is the Name Box |
| Fill Series, Fill Up/Left | `edit.fillSeries`, `edit.fillUp` | 1, 2, 3 …; steps; dates; Mon/Tue; Q1/Q2. `copy.ts` has fill down and right |
| AutoSum | `formulas.autoSum` | SUM (or SUM_RANGE) of the numbers above or left of the cursor |
| Paste Special | `edit.pasteSpecial` | Values, formulas, formats (notes), transpose; `copy.ts` and `notes.ts` |
| Clear contents / formats / comments | `edit.clear*` | Each a setMany or a notes edit |
| Data validation | `data.validation`, `data.circleInvalid` | List, whole number, decimal, text length, custom formula; refuse or warn on commit; circle (style) what fails. The Tauri app has onCreate/onUpdate rules too |
| Remove Duplicates | `data.removeDuplicates` | Rows of a range, by chosen columns |
| Text to Columns | `data.textToColumns` | Split by a delimiter into the cells to the right |
| Flash Fill | `edit.flashFill` | Infer a pattern from one or two examples; the hardest of these |
| Conditional formats as rules | `home.conditionalFormat`, Manage Rules | Colour scales (two or three colours) and icon sets (a glyph in the text) fit `cell_style` today; "top 10", "above average", "duplicate values" are rules over a range; data bars need aether-ui (below) |
| Number formats, all of them | `home.numberFormat` and friends | Idea 3; plus Increase/Decrease Decimal, Accounting, Comma |
| Formula auditing | `formulas.tracePrecedents`, `traceDependents`, `showFormulas`, `evaluateFormula`, `watchWindow`, `errorChecking` | The Sheet has both edges; tracing is a `cell_style` background on what a cell reads or is read by; Show Formulas shows inputs; a watch window is an `each` |
| Goal Seek | `data.goalSeek` | Vary one input until a formula hits a value (secant method over `Sheet.set`; async is fine) |
| Data Table, Scenario Manager | `data.dataTable`, `data.scenarioManager` | What-if: a formula over a row and column of inputs; saved input sets |
| Subtotal, Group/Outline | `data.subtotal`, `data.group` | Subtotal rows are model work; collapsing a group needs hidden rows |
| Several sheets | `home.insertSheet`, `sheet.rename`, `sheet.move` | Already on the list; tabs as buttons; `Sheet2!A1` and the app's `Sheet2.A1` |
| More functions | 513 of them | Worth taking first: IFS, SWITCH, XLOOKUP, XMATCH, SUMIFS/COUNTIFS/AVERAGEIFS, TEXTJOIN, date and time (DATE, EDATE, EOMONTH, NETWORKDAYS, the coarse clock for TODAY/NOW), PMT/FV/NPV/IRR, RANK, PERCENTILE, LET. GridCraft's `crates/functions/src` (criteria, lookup, financial, date) is a reference for the edge cases |
| LAMBDA, MAP, REDUCE, BYROW | special forms | In the Excel language; RexxJS already has pipes and array functions |
| Dynamic arrays and spilling | `crates/calc` | FILTER, SORT, UNIQUE, SEQUENCE: a formula that fills a range, the Sheet owning the spill. A larger change to `sheet.ts`; worth doing once named ranges and several sheets are in |
| Tables and structured references | `insert.table`, `Table1[Price]` | The Tauri app's TABLE() and table metadata too; banded rows are `cell_style` |
| CSV in and out | `file.exportCsv`, `data.fromTextCsv` | `copied()` and `pasted()` are most of it; storage in the browser, `files` in app mode |
| Saving and opening | `file.save`, `file.open` | Already on the list, in the Tauri app's format |
| Sparklines and charts | `insert.sparkline`, `insert.chart` | A `vg` scene beside the grid, redrawn on change (seventeen chart types there; bar, line and pie first). GridCraft's `crates/chart` lays charts out without a toolkit, which is what `vg` wants |

## Features that need aether-ui first

`ui.datagrid` draws a cell's text, background, colour, bold and alignment.
These need more of it (asked for in
`asks/aether-ui-datagrid-rows-and-cells.md`, as
`asks/aether-ui-datagrid-style-hash.md` was):

- **Hidden rows and columns**, which AutoFilter, outlines, Hide/Unhide and
  the Tauri app's row filter all need.
- **Frozen rows** (Freeze Top Row, Freeze Panes); it freezes leading
  columns already.
- **Italic, underline, strikethrough, font size**, and **borders**.
- **Merged cells** (Merge & Center; the Tauri app merges too).
- **Wrapped text and row heights.**
- **A fill fraction per cell**, for data bars.
- **A corner marker** on a cell with a comment, and a hover to read it.
- **Editor events while typing a formula**, for point mode (click a cell to
  insert its reference) and coloured references.
- **Pictures in cells**, and checkboxes (`insert.checkbox`).

## Features that do not fit, or not yet

- **XLSX, XLS, XLSB, ODS.** XLSX is zip and XML; a TypeScript reader is
  possible but large (deflate, styles, shared strings), and fidelity is
  GridCraft's own top gap. CSV and the Tauri app's JSON first.
- **The ribbon, Backstage, themes, Draw (ink), shapes, SmartArt, WordArt.**
  Demo 18's UI is a few rows of buttons, deliberately.
- **PivotTables, slicers, Get & Transform, Solver, the Analysis ToolPak,
  forecasting.** Each is its own product; a small pivot (group and sum, as
  the Tauri app's GROUP_BY does) is reachable through the query functions
  already on the list.
- **Print and PDF**, **spelling and thesaurus**, **protection and
  collaboration**, **localization**.

## Recommended order

1. ~~The command layer (idea 1), with RexxJS's `ADDRESS SHEET` over it~~
   (done: `site/sheet/commands.ts`, the page as panels over it).
2. ~~Named ranges and the Name Box~~ (done).
3. ~~Fill Series, AutoSum, Paste Special, the Clear variants~~ (done).
4. ~~Data validation~~ (done).
5. ~~Several sheets~~ (done: `sheet.add`, `sheet.activate`,
   `sheet.delete`, tabs, `Costs!B2` and `Costs_B2`).
6. ~~Saving and opening, and CSV~~ (done: `file.save`, `file.open`,
   `file.list`, `file.delete`, `file.new`, `file.exportCsv`,
   `file.importCsv`).
7. ~~Formula auditing, and Show Formulas~~ (done: trace precedents and
   dependents, remove arrows, Show Formulas, Evaluate Formula with a
   formula printer, the Watch Window).
8. ~~The number-format language; conditional-format rules (colour
   scales, icon sets)~~ (done: `numfmt.ts`, `rules.ts`, the `format.*`
   commands; data bars too, once aether-ui drew them).
9. ~~Charts and sparklines in `vg`~~ (done: `charts.ts`, the chart panel,
   SPARKLINE).
10. ~~Functions in batches (lookup and conditional, date, financial), then
    LET and LAMBDA, then dynamic arrays~~ (done: 135 functions and special
    forms, spilling).
11. ~~Goal Seek, Data Table, Remove Duplicates, Text to Columns~~ (done:
    `whatif.ts`, the `data.*` commands, the data bar).
12. ~~The aether-ui asks~~ (done: `asks/aether-ui-datagrid-rows-and-cells.md`,
    landed in aether-ui `08e3193d`; demo 18 has all seven).

All twelve are done. What follows is kept in
`docs/spreadsheet_demo_done_and_todo.md`'s "To do".
