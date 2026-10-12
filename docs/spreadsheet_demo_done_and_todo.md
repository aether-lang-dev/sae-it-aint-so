# The spreadsheet demo: done, and still to do

Demo 18 (`docs/roadmap.md`), `site/sheet.ts`, as of 2026-10-12, pinned
to aether-ui `0cfbf942`. It began as the third of five
demo ideas meant to show off sae's TypeScript dialect, and grew into the
sae page that uses the most of the page API. It is taking in the Tauri
spreadsheet (RexxJS/example-app-spreadsheet) as pure sae TypeScript, with
no DOM: its RexxJS formulas are one of two major settings, and its other
features are coming over one by one ("From the Tauri spreadsheet", below).

## What it is

A 10 x 20 sheet (A1 to J20) on `ui.datagrid`. You type into a cell, or into
the formula bar above it; formulas start with `=`; edits ripple to every
cell that reads the changed one.

**In the grid** (all aether-ui's datagrid):

- Selection: a click, the arrow keys, Shift to extend, Home/End, Page keys.
  The formula bar follows the selected cell.
- In-cell editing: F2, a double click or typing opens an editor. The editor
  opens on the formula (`edit_text`), not the value it came to. Return and
  Tab commit, and Escape cancels.
- Columns: drag a header's grip to resize, double-click it to fit the
  column to its text, and drag a header to move its column.
- Styles (`cell_style`): numbers right-aligned, errors red, row numbers
  grey.

**Over a selection** (the page's `ui.on_key`, while the grid has the focus
and no editor is open; `ui.datagrid_has_focus` tells it so):

- Ctrl+D fills down: each column's top cell into the cells below it. Ctrl+R
  fills right. A selection one row tall (one column wide) fills from the
  row above (the column to its left), as a spreadsheet's does.
- Ctrl+C copies the selection and Ctrl+V pastes it at the selected cell.
  Relative references move by the distance (`=B2*2` copied one down is
  `=B3*2`), `$` fixes a column, a row or both (`=SUM($A$1:A1)` is a
  running total), and a reference moved off the sheet becomes `#REF!`.
  Only references change; the rest of a formula is kept as typed. The
  clipboard is the page's own: there is no system clipboard for pages yet.
- Delete or BackSpace clears it. In the formula bar they are the field's.
- Ctrl+Z undoes the last change (a paste or a fill is one), with its
  ripple, and Ctrl+Y or Ctrl+Shift+Z redoes it; Undo and Redo buttons too.
  A hundred steps are kept, as the Tauri app keeps; opening a file starts
  afresh.
- Insert row and Insert column put as many empty rows (columns) before the
  selection as it covers; Delete row and Delete column take away the ones
  it covers. Every reference follows, $ or not, in either language: a
  range grows over an insertion and shrinks over a deletion, and a
  reference into what was deleted is `#REF!`. Notes and conditional styles
  move with their cells. One change, so one undo; a non-empty cell would
  never be pushed off the sheet (the insertion is refused).
- Sort A→Z and Sort Z→A order the selection's rows by the cursor's
  column: numbers, then text (without case), then empty cells; equal ones
  keep their order. A row moves whole, its formulas rewritten as a copy by
  the rows it moved, and its notes with it.
- Fill Series continues each column (or row) of the selection from its
  first cells: numbers by 1 or their step, dates, text ending in a
  number, days, months and quarters round and round, a formula moved as
  Fill Down moves it. AutoSum sums the numbers just above (or to the left)
  in the sheet's language (`=SUM(B1:B5)`, `=SUM_RANGE("B1:B5")`).
- Paste Special: values (what the cells showed), formulas (moved, without
  formats), formats (the notes alone), or all, transposed or not. Clear
  formats, Clear comments and Clear cells (inputs and notes).
- Data validation on the selection (the validation bar): a list, whole
  numbers or decimals within limits ("1..10", ">=0"), a text length; stop
  (refuse, and say why) or warn (keep, and say so); and, from the Tauri
  app, on create or on update only. Typed values are checked (pastes and
  fills are not, as in Excel); Circle invalid marks what breaks a rule.
  Rules move with their cells.
- Named ranges: name the selection (the names bar), and a formula reads
  the name in either language (`=SUM(qty)`, `=SUM_RANGE("qty")`, a bare
  `rate`); redefining it moves what reads it, deleting it makes them
  `#NAME?` (as an Excel formula's unknown name is). The address field is
  the Name Box: Return on a name selects its range.
- Find (a field, and Match case, Whole cell and In formulas) lists the
  matches and selects the next; Replace all changes every match in
  constants (in formulas' text too, when asked), as one undo.

**Around the grid** (the page's own `state`, `computed`, `bind`, `each` and
`batch`):

- A formula bar: a cell field and a formula field, both bound two-way.
  Return in the cell field moves to the formula field; Return in the
  formula field enters the formula.
- A status line for the selected cell, e.g. `D1: =SUM(A1 → #ERROR! parse
  error at 8: expected ')' but found the end`.
- A problem list (`each`, keyed by cell) and a summary (`computed`).
- Paste example: 24 cells set in one recompute, one `batch` and one grid
  refresh. Clear all empties the sheet.
- The function list (`ui.text_wrapped`).

**The major setting: Excel formulas or RexxJS formulas.** Two buttons
switch it; every formula is read again in the other language and the sheet
is worked out again (a formula of one is usually an error in the other,
and comes back when switched back).

- **Excel formulas** are the language below.
- **RexxJS formulas** are the Tauri app's: a RexxJS expression (`=A1 + B1`,
  `=UPPER(A2) || '!'`, `=A2 |> LOWER`, `=B2 > 500`), worked out as
  `LET CELLRESULT = ...` on one interpreter whose unset variables that name
  cells read the sheet. A sheet's setup script (`LET TAX_RATE = 0.08`) runs
  on it first. The app's range functions are here in TypeScript:
  SUM_RANGE, AVERAGE_RANGE, COUNT_RANGE, MIN_RANGE, MAX_RANGE,
  MEDIAN_RANGE, STDEV_RANGE, STDEVP_RANGE, VAR_RANGE, VARP_RANGE,
  PRODUCT_RANGE, SUMIF_RANGE, COUNTIF_RANGE and CELL, plus all of RexxJS's
  own (UPPER, SUBSTR, WORD, LENGTH, ...). An error is `#ERROR!` with
  RexxJS's reason; an error a formula reads is that error.
- The app's sheet files (its `.json` and `.rexxsheet`) open with their
  setup script, cells and notes: "Budget (RexxJS)", "Test sheet (RexxJS)"
  and "Formatted (RexxJS)" are its three samples.

**What a cell carries besides its input** (`notes.ts`, `formats.ts`), as
the app's cells do, set from a file or by hand in the comment and format
fields under the formula bar:

- A comment, on the status line after the value.
- A number format, in the app's dialect (`number:0.00`, `currency:USD`,
  `percent:0.0%`) or Excel's (`$#,##0.00`, `0.00%`, `#,##0`).
- A style, as the app's format strings (`bold;color:red;align:center`) or
  CSS objects have it, drawn as the grid can: background, colour, bold,
  alignment (italic and sizes need aether-ui).
- A conditional style: an expression in the sheet's language whose value
  is a style, worked out after every change. In RexxJS formulas the app's
  style functions give one (`STYLE_IF(C5 < 0, RED_TEXT(), GREEN_TEXT())`,
  `STYLE(...)`, `BG_COLOR`, `BOLD`, `GREEN_BG()` ...); in Excel ones a
  string does (`IF(C5 < 0, "color: red", "")`).

**The Excel formula language:**

- Numbers, strings with `""` escapes, TRUE/FALSE, cell references (`A1`,
  `$A$1`, `A$1`, `$A1`) and ranges, and the errors written as values
  (`#REF!`, `#N/A`, ...).
- Operators: `+ - * / ^ &` and the comparisons, with spreadsheet
  precedence. Unary minus binds tightest, so `-2^2` is 4.
- 53 functions (`site/sheet/functions.ts`):
  - maths and statistics: SUM, PRODUCT, AVERAGE, MIN, MAX, MEDIAN, STDEV,
    COUNT, COUNTA, COUNTBLANK, ABS, SIGN, INT, ROUND, ROUNDUP, ROUNDDOWN,
    MOD, POWER, SQRT, PI;
  - conditionals with spreadsheet criteria (`">3"`, `"<>"`, `""`): SUMIF,
    COUNTIF, AVERAGEIF;
  - logic: IF (only the branch taken is worked out), AND, OR, NOT, IFERROR,
    ISERROR, ISNUMBER, ISTEXT, ISBLANK, CHOOSE;
  - text: CONCAT, TEXTJOIN, LEN, UPPER, LOWER, PROPER, TRIM, LEFT, RIGHT,
    MID, FIND, SUBSTITUTE, REPT, EXACT, VALUE;
  - lookup: INDEX, MATCH (exact, ascending, descending), VLOOKUP (exact and
    approximate), ROWS, COLUMNS.
- Errors are values that flow through whatever reads them: `#DIV/0!`,
  `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!` (with the path,
  `A2 → B2 → A2`), and `#ERROR!` (a parse error, with the column).

## How it is built

Three layers, each testable on its own:

1. **The page** (`site/sheet.ts`, 30 lines) only declares which panels, in
   which order: `languageBar(sheet); formulaBar(sheet); notesBar(sheet);
   statusLine(sheet); sheetGrid(sheet); editBar(sheet); ...`.
2. **The panels** (`site/sheet/view/`, one file each: the grid, the
   formula bar, the notes bar, the edit bar, the find bar, the file bar, the
   command bar, the lists) are pseudo-declarative Sae-TS: widgets bound to
   state, and handlers that run commands and nothing else, through
   `SheetView.run` (`view.ts`), which runs a command, prints its outcome
   (`sheet: ...`, what specs read) and shows the workbook again in one
   batch.
3. **The seam** (`commands.ts`, `workbook.ts`, `script.ts`), with no `ui`:
   every action on the workbook is a command with an id and string
   parameters (`data.sortDescending range=F4:G7 by=G`), as GridCraft's
   engine commands and the Tauri app's control bus have them. A command
   gives an Outcome (ok or refused, a message, what changed, an output);
   the ones that change the workbook are journaled as command lines, which
   replay. Three things drive it: the panels; RexxJS scripts, through
   `ADDRESS SHEET "..."` (RC and RESULT), `SETCELL` and `GETCELL`, on an
   interpreter of their own, `;` ending a clause; and specs, headless
   (`sheet_commands`) and in the browser through the page's command bar
   (`griddriver`'s `command` and `script`), as a person would type them.

The model under the seam has no `ui`, and is about 1,900 lines of dialect
in `site/sheet/` (and the generated RexxJS bundle):

| Module | What |
|---|---|
| `address.ts` | A1..J20; ranges as a generator; a template-literal `Key` type |
| `lexer.ts` | A tokenizer generator; each token knows its column, for errors, and a reference its `$`s |
| `parser.ts` | Recursive descent into a discriminated `Expr`, with binary operators by precedence climbing over a table |
| `values.ts` | `CellError`, the coercions, `compare` |
| `functions.ts` | The library: each function declared with its arity, given `Arg`s (a range's cells and width, or one value; an error arrives as a value) |
| `evaluate.ts` | The evaluator; IF is its special form |
| `format.ts` | `show`, the `fmt` tagged template, the status line |
| `sheet.ts` | `Sheet`: inputs, compiled formulas, `Map<string, Set<string>>` edges both ways; Kahn's algorithm downstream of a change; what it cannot order is checked for cycles |
| `language.ts` | `Language`: what a formula reads, what it comes to (perhaps a promise), and how it reads moved; the major setting is which one the Sheet holds |
| `excel.ts` | The Excel language over the modules above; moving a formula token by token |
| `rexx.ts` | The RexxJS language: one interpreter, cells read through its `variableResolver`, the setup script, the app's range functions in TypeScript, the app's copy rule |
| `rexxjs.js` | RexxJS itself, generated by `tools/bundle-rexxjs.mjs` from `vendor/rexxjs` (its 61 modules, and `patches/`) |
| `file.ts`, `samples.ts` | The Tauri app's sheet file format (its three cell shapes), and its three sample sheets |
| `notes.ts`, `formats.ts` | A cell's comment, format, style and conditional style; number formats and styles in the app's dialects, as the grid draws them |
| `shift.ts` | Edits that move references (a copy's offset, rows or columns inserted or deleted), which each language's `rewrite` applies to a formula; `restructured` moves a sheet's cells by one |
| `sortfind.ts` | Sorting a range by a column (and where each cell went, for notes), find and replace |
| `commands.ts` | The seam: the catalogue of commands, the command line, the journal, scripts |
| `workbook.ts` | The Sheet, notes, both languages, the file's name and setup script, the clipboard, conditional styles; what a cell shows, its style, its status line |
| `script.ts` | RexxJS scripts over the commands: ADDRESS SHEET, SETCELL, GETCELL |
| `copy.ts` | A formula moved (its references rewritten token by token, so the rest stays as typed); copy as tab-separated text; paste, moving formulas when the text came from the sheet; fill down and right. Gives `[key, input]` pairs for `Sheet.setMany` |

The prelude's `computed` takes a fixed list of input states, and a sheet's
dependencies change with every edit, so the `Sheet` is its own dynamic
`computed`. Reactive state is used where its inputs are fixed: the
selection, the formula bar, the status line, the problem list and the
summary.

## How it is tested

- **Headless** (`lower/run-tests.sh`, on sae's own QuickJS):
  - `sheet_syntax` (35 checks): addresses, tokens and their columns, `$`
    references, error literals, every AST form, precedence, every parse
    error and where it is.
  - `sheet_evaluate` (29): operators, coercions, errors as values,
    formatting, a status line with a comment.
  - `sheet_functions` (46): every function, its edge cases and its errors,
    against a fixed set of cells.
  - `sheet_sheet` (39): the `Sheet` against a recording mock listener.
    Edits ripple in dependency order; a paste recomputes each cell once;
    cycles are found and mended; a formula forgets what it used to read.
    And against a stub language: compiled once, run in dependency order and
    awaited, everything compiled again in another, changes taking turns.
    Undo and redo: a step per change, a paste as one, a hundred kept.
  - `sheet_notes` (18): number formats and styles in each dialect, notes,
    the formatted sample read, its ledger worked out, and its conditional
    styles evaluated in RexxJS by the app's style functions.
  - `sheet_shift` (19): references under each edit in both languages
    (ranges growing and shrinking, `#REF!`), a sheet's cells restructured,
    notes and conditional styles following, and one undo through a Sheet.
  - `sheet_sortfind` (14): sort order (numbers, text, empty; stable), rows
    moving whole with their formulas and notes, find and replace with each
    option.
  - `sheet_commands` (27): the seam. The command-line grammar, the
    catalogue, refusals, every command the panels run, the journal
    replayed to the same sheet, RexxJS scripts (ADDRESS SHEET, SETCELL,
    GETCELL, RC and RESULT, `;`), and a formula refused SETCELL.
  - `sheet_editing` (20): series of each kind, Fill Series down and right
    (formulas moved), AutoSum in both languages and its refusals, Paste
    Special values, formulas, formats and transposed, the Clears.
  - `sheet_validation` (16): each kind of rule and its limits, stop and
    warn, on create and on update, refusals, a paste got past and
    circled, rules moving with rows, cleared.
  - `sheet_names` (12): names defined, read in both languages, followed,
    deleted to `#NAME?`, refused, listed, journaled.
  - `sheet_rexx` (25): RexxJS formulas against a stub of the cells (what a
    formula reads, Rexx's operators and functions, errors, the setup
    script, every range function, the copy rule), then the Tauri app's two
    sample sheets through a Sheet, each cell at the value the file stored.
  - `sheet_copy` (26): moving formulas (relative, `$`-fixed, ranges, off
    the sheet, kept as typed), copy as text, paste from the sheet and from
    elsewhere, fill down and right.
- **In the browser** (`tests/run_all.sh spec_sheet`, 32 tests, on GTK4
  under Xvfb):
  - formulas, ripples, parse errors in red, cycles, the paste;
  - lookups, conditionals and IFERROR on the example;
  - an in-cell edit that opens on `=B2*C2` and ripples into D5;
  - the grid's keys, a grip drag, a grip double-click that fits;
  - Ctrl+D and Ctrl+R; Ctrl+C and Ctrl+V moving `=$B$2+C2` to
    `=$B$2+D4`; Delete over a selection, and not while the formula field
    has the focus; Ctrl+Z, Undo and Redo; and Clear all;
  - the app's budget in RexxJS formulas (its setup script's TAX_RATE, a
    comment), RexxJS's `||`, `|>` and `>`, an error's reason, and the
    setting switched to Excel and back;
  - the app's formatted sheet: number formats, its styles, conditional
    styles that follow an edit, and a format and a comment set by hand;
    a row inserted into its ledger and deleted again; its products sorted
    by percentage, their conditional colours following (aether-ui
    `0cfbf942` redraws a cell whose style changes); find, Replace all and
    its undo;
  - the command bar: a command run as the panels run theirs, a refusal
    and why, an output; a RexxJS script through ADDRESS SHEET, SETCELL
    and GETCELL, and its changes undone.

  Cells are read and clicked through the driver's widget tree: the
  `aui-grid-cell` under its column's header and beside its row's number.

## How it got here

1. First version: 200 buttons in a `ui.grid`.
2. Then a `vg` scene, for drag-to-resize columns. That turned up:
   - aether-ui losing a text's transform on the live path, fixed in
     b3d697c9 (`asks/aether-ui-vg-text-transform.md`);
   - sae repainting the whole scene on every `vg.set`, which cost 1.4 s a
     drag step on GTK4 (sae now holds repaints while a canvas handler runs:
     36 ms);
   - double clicks that could never land, because each press took over a
     second to handle.
3. The wishlist that followed (text measurement, movable text, keys,
   Return, wrapping, a canvas query, a table widget) produced `ui.on_key`,
   `ui.on_submit`, `vg.measure`, `vg.ellipsize`, `ui.text_wrapped`,
   `saedriver.vg_nodes` and `ui.datagrid` with `edit_text`, `cell_style`
   and `datagrid_fit_col`.
4. The page moved onto the datagrid, and the `vg` grid went (it is in git
   history).

Building the earlier algorithms demo (17) found the lowerer's two bugs, now
fixed: nested generics closed by `>>`, and union types written one member a
line.

## To do

Roughly in order of value for effort.

`docs/gridcraft-audit.md` sets this list against GridCraft (an Excel
reimplementation in Rust) and recommends an order: a command layer first,
with RexxJS's `ADDRESS SHEET` over it, then the features below and more.

**From the Tauri spreadsheet** (RexxJS/example-app-spreadsheet; its model
is `src/spreadsheet-model.js`, its control functions
`src/spreadsheet-control-functions.js`). Each lands in the model with no
`ui` and its checks headless, then on the page with an `it`:

1. **Several sheets**, with cross-sheet references (`Sheet2.A1` in the
   app; `Sheet2!A1` in Excel formulas).
2. **Saving and opening**: the app's file format, written by `file.ts`
   too, through `storage` in the browser and `files` in app mode.
3. **The query functions**: `RANGE("A1:C9") |> WHERE("price > 10") |>
   GROUP_BY("region")`, PLUCK, SUM, AVG, COUNT, RESULT and TABLE over a
   table's metadata (the app evaluates WHERE's condition with JavaScript's
   `eval`; here it would be the sheet's own language).
4. **Hide rows and columns, freeze panes** (the datagrid freezes leading
    columns already), **text wrapping**, **conditional formatting** (a
    RexxJS or Excel expression giving a style), **data validation**
    (lists, number ranges, patterns; on create, on update), **auto IDs**.
5. **The control functions** (SETCELL, GETCELL and the rest) in RexxJS
    formulas and the setup script, and a **control bus** for other apps
    (the app's is HTTP or postMessage; sae's would be a page service).
6. **Charts** of a range in `vg` (the app's chart scripts drive Chart.js).

Not coming over: the DOM itself (React, the DOM functions RexxJS has for
web pages), and Pyodide (NumPy, SciPy, SymPy in WebAssembly).

**Demo 18's own:**

1. **The system clipboard.** Copy and paste work within the sheet only.
   Copying out to other apps, and pasting in from them, needs a clipboard
   API for pages: a page service with a permission, like `files`. Text
   pasted from elsewhere would go through `pasted()` with no `from`, so its
   formulas are taken as written.
2. **Cut, and paste over a larger selection.** Ctrl+X (a copy, then a
   clear of the source on paste) and a one-cell copy pasted over a range
   (repeated into each cell) are both small, in `copy.ts`.
3. **A bigger sheet.** The app's sheets are 26 x 100. The grid is
   virtualised (4,000 cells shown at once), but `address.ts` allows only columns A to J and two-digit rows. AA-style
   columns and larger limits are the address regexes plus `COLS`/`ROWS`.
   Recompute already touches only what is downstream of a change.
4. **More functions.**
   - Dates need a clock, which pages get coarse (sae's web rules), so
     TODAY and NOW would read the coarse clock.
   - HLOOKUP, XLOOKUP, SUMPRODUCT, COUNTIFS and SUMIFS, and ROUND's
     siblings.
   - Each is a `def()` plus checks in `sheet_functions.ts`.
5. **Highlighting what a formula reads.** While a formula is being edited,
   the cells it references could take a `cell_style` background; the
   parser already gives `refsOf`.

**Correctness edges, known and accepted:**

- Comparisons between text and numbers use text order. Spreadsheets
  instead rank all numbers below all text.
- AND and OR skip text in their arguments, and give `#VALUE!` when nothing
  is left. Some spreadsheets coerce `"TRUE"` instead.
- VLOOKUP's approximate match, and MATCH types 1 and -1, assume sorted
  data, as spreadsheets do, and say nothing when it is not.
- A formula's result that is an empty cell shows as 0, as spreadsheets do.

**Platform and tests:**

- `spec_sheet` has run on GTK4 (Linux, Xvfb) only. `spec_grid` is green on
  macOS and on both GTK lanes; `spec_sheet` should be run on a Mac too.
- On Linux, `spec_aevg`, `spec_camera`, `spec_raster`'s Home click and
  `spec_nav`'s scoped-seeks case fail on GTK4 (aether-ui bugs, open).
  `spec_app_httplist` needs `api.localhost` in a container's `/etc/hosts`
  (`CLAUDECODE-CLOUD.md`).
- aether-ui's `scene_refresh` could coalesce to one repaint a frame (its
  `TODO.md`): a nice-to-have, since the spreadsheet no longer draws in
  `vg`.
