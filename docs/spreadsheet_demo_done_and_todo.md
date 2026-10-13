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
- While a formula is typed, the references it names are outlined in
  colour, one colour each in order, as Excel draws them; with the caret
  after `=`, an operator, `(`, `,` or `:`, a click on a cell puts its
  reference in (point mode): the click commits the editor first, so the
  page holds that commit back and opens the editor again with the
  reference added, the caret after it and the focus in it.
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
- Several sheets, as tabs under the grid: a button per sheet, Add sheet
  (named in the field, or Sheet2, Sheet3 ...) and Delete sheet (the active
  one; never the last). A formula reads another sheet's cells:
  `=Costs!B2`, `=SUM(Costs!B1:B3)` and `='My Costs'!B2` in Excel formulas,
  `=Costs_B2` and `=SUM_RANGE("Costs!B1:B3")` in RexxJS ones (the Tauri
  app's `Sheet2.A1` is a compound variable in RexxJS, so sae takes `_`; an
  unset `Name_A1` variable is always a reference, a set one is the
  script's). It follows them when they change, and reads `#REF!` ("no
  sheet COSTS") when there is no such sheet, until there is again. A copy
  moves a reference to another sheet as any other; rows or columns
  inserted on a sheet move every sheet's references to it, and no others.
  The language is the workbook's, for every sheet; each sheet has its own
  named ranges and its own undo.
- Conditional formatting rules over the selection (the rules bar), as
  Excel's menu has them: Highlight Cells (greater than, less than, equal
  to, text that contains; between and the rest by command), Top 10 (or
  bottom, or a percent), Above average (or below), Duplicates (or unique),
  a colour scale (Excel's red, yellow, green, or two or three of one's
  own), an icon set (arrows, triangles, ratings, before the text), Clear
  rules. Each sheet has its rules, the first listed winning; they follow
  edits, move with inserted and deleted rows, and are saved with the
  file. Data bars (a share of the largest number, from the cell's end when
  negative) too.
- Rows and columns out of view (the view bar): Hide and Unhide rows and
  columns (select across hidden ones to unhide them, as in Excel); a
  filter on the selected column of a table (the criterion as COUNTIF
  writes one: `>100`, `north`), its header row kept, Clear filter; Freeze
  top row and Unfreeze. Per sheet; hidden rows move with inserted and
  deleted ones; saved.
- What-if and data tools (the data bar), as Excel's Data tab has them:
  Goal Seek (the selected formula brought to a goal by changing one
  input, the secant method over the sheet); Data Table (a formula worked
  out for each value of a row input, a column input or both, the results
  written as values); Remove Duplicates (rows whose chosen columns repeat
  an earlier row's, any case, the rest moved up with their formulas);
  Text to Columns (split in place at a delimiter, quotes kept together,
  numbers as numbers; not over cells holding something unless told).
  Trials set cells with no undo steps (`Sheet.trial`); each is one step.
- Charts of the selection (the chart panel): bar, line and pie, each a
  `vg` scene under the sheet, redrawn as its cells change, with a title,
  round ticks, categories and a legend; Excel's reading of a range (text
  down the first column names the categories, across the first row the
  series). They are laid out with no toolkit (`charts.ts`, as GridCraft's
  chart crate does), so the layout is checked headless and the page only
  draws shapes. A sparkline is text in a cell: `=SPARKLINE(B2:B9)` in
  Excel formulas, `=SPARKLINE_RANGE("B2:B9")` in RexxJS ones, eight
  heights of block (`▁▃▅█`); the Sparkline button puts one beside the
  selection. Charts move with inserted rows and are saved with the file.
- Formula auditing (the audit bar), as Excel's Formulas tab has it:
  Trace precedents marks what the selected cell reads in blue, Trace
  dependents what reads it in orange, a level further each time and
  across sheets (`A1 is read by A2 A3 Costs!B1, and they are read by
  A4`); Remove arrows. Show formulas shows inputs in the grid. Evaluate
  formula steps through an Excel formula as Excel's dialog does, leftmost
  innermost first, a range as an array, IF taking only its branch
  (`SUM(H18:I18) → SUM({2,42}) → 44`); it is printed by a formula printer
  (`audit.ts`: upper case, parentheses only where precedence needs them).
  Add watch keeps a cell, on any sheet, in the Watch Window with its
  formula and value as they change.
- Files (the file bar): Save keeps the workbook in the page's `storage`
  under a name (every sheet, its notes, rules and names, its language and
  setup script), Open brings it back worked out, Delete file forgets it,
  and the saved files are listed; New starts an empty workbook. The
  format is the Tauri app's (a formula as its value and expression, notes
  beside), with sae's additions the app passes over: validation rules,
  named ranges, and the other sheets. Export CSV gives what the selection
  (or everything used) shows; Import CSV puts the CSV field's rows at the
  selected cell, as many lines as the CSV field (a textarea) holds.

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
  `percent:0.0%`) or Excel's number-format language, all of it
  (`numfmt.ts`): sections for positive, negative, zero and text
  (`#,##0;[Red](#,##0);"-";"Note: "@`), colours and conditions in
  brackets, literals quoted, escaped or bare, `0 # ?` placeholders,
  thousands and scaling commas, percent, scientific and engineering,
  fractions (`# ?/?`, `# ?/8`), and dates and times on Excel's serial
  numbers (`d mmm yyyy`, `h:mm AM/PM`, `[h]:mm`; a date typed as
  `2024-01-15` is formatted as one). A section's colour is the cell's
  text colour.
- A style, as the app's format strings (`bold;italic;color:red;align:center`)
  or CSS objects have it, drawn as the grid can: background, colour, bold,
  alignment, italic, underline, strikethrough, sizes, borders, wrapping.
- A look (the look bar; `format.font`, `format.border`, `format.wrap`):
  Bold, Italic, Underline and Strikethrough (Ctrl+B, Ctrl+I, Ctrl+U),
  outline, all or no borders, Wrap text (its row as tall as its text). Paste
  Special formats takes it, Clear formats clears it, a file keeps it.
- A comment shows as a red corner, and its text when the pointer rests on
  the cell.
- Merged cells (the look bar; `cells.merge`, `cells.unmerge`): Merge &
  center, Merge, Unmerge. A merge keeps its top-left's value and clears
  the rest, as Excel warns it will, and replaces merges it overlaps; one
  cell is drawn over the range. Rows set to a height (the view bar's
  `row height`; `rows.height`, 0 for the grid's). Both move with inserted
  and deleted rows and are saved.
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
- LET and LAMBDA: `=LET(x, A1, sq, LAMBDA(n, n*n), sq(x) + 1)`. Each of
  LET's values sees the names before it, an inner name hides an outer
  one, a LAMBDA's body sees the names where it was written, and it is
  called at once (`LAMBDA(x, x*2)(5)`) or through a name. A formula that
  comes to a LAMBDA is `#CALC!`. (Named LAMBDAs in the Name Manager, and
  so recursion, are still to come.)
- Dynamic arrays, as Excel 365 has them. A formula may come to an array:
  a range, an operator over ranges cell by cell (`=A1:A3*2`; a row or a
  column broadcast across the other, `#N/A` where one runs out), IF over
  one, SEQUENCE, FILTER, SORT, SORTBY, UNIQUE, TRANSPOSE, an XLOOKUP that
  returns a row, and MAP, REDUCE, SCAN, BYROW, BYCOL and MAKEARRAY with a
  LAMBDA. It spills into the cells below and to the right: they show its
  values and are read as any cell, `A1#` is all of it (and moves in a
  copy), and an input in the way, or the sheet's edge, makes it `#SPILL!`
  until cleared. (Scalar functions do not yet lift over arrays:
  `UPPER(A1:A3)` is `#VALUE!`; spills are within a sheet.)
- 108 functions (`site/sheet/functions.ts`), and arguments left out
  (`XLOOKUP(25,E1:H1,E2:H2,,-1)`):
  - maths and statistics: SUM, PRODUCT, AVERAGE, MIN, MAX, MEDIAN, STDEV,
    COUNT, COUNTA, COUNTBLANK, ABS, SIGN, INT, ROUND, ROUNDUP, ROUNDDOWN,
    MOD, POWER, SQRT, PI;
  - conditionals with spreadsheet criteria (`">3"`, `"<>"`, `""`): SUMIF,
    COUNTIF, AVERAGEIF, and over several criteria SUMIFS, COUNTIFS,
    AVERAGEIFS, MAXIFS, MINIFS; SUMPRODUCT;
  - order statistics: LARGE, SMALL, RANK, PERCENTILE, QUARTILE, MODE, VAR,
    VARP, STDEVP;
  - logic: IF (only the branch taken is worked out), AND, OR, NOT, IFERROR,
    ISERROR, ISNUMBER, ISTEXT, ISBLANK, CHOOSE, IFS, SWITCH, IFNA, NA;
  - text: CONCAT, TEXTJOIN, LEN, UPPER, LOWER, PROPER, TRIM, LEFT, RIGHT,
    MID, FIND, SUBSTITUTE, REPT, EXACT, VALUE;
  - lookup: INDEX, MATCH (exact, ascending, descending), VLOOKUP and
    HLOOKUP (exact and approximate), XLOOKUP and XMATCH (exact, next
    smaller or larger, wildcards `* ? ~`; first to last or last to first;
    a value if not found), ROWS, COLUMNS;
  - dates and times on Excel's serial numbers (`dates.ts`; a date argument
    may be text, `2024-01-15` or `1/15/2024`): DATE, DATEVALUE, YEAR,
    MONTH, DAY, WEEKDAY, EDATE, EOMONTH, DAYS, DATEDIF, NETWORKDAYS,
    WORKDAY, TIME, HOUR, MINUTE, SECOND, TODAY and NOW (on the page's
    coarse clock; worked out when the cell is, not on every change);
  - money (`finance.ts`): PMT, FV, PV, NPER, RATE, NPV, IRR;
  - SPARKLINE.
- Errors are values that flow through whatever reads them: `#DIV/0!`,
  `#VALUE!`, `#REF!`, `#NAME?`, `#NUM!`, `#N/A`, `#CYCLE!` (with the path,
  `A2 → B2 → A2`), and `#ERROR!` (a parse error, with the column).

## How it is built

Three layers, each testable on its own:

1. **The page** (`site/sheet.ts`, 35 lines) only declares which panels, in
   which order: `languageBar(sheet); formulaBar(sheet); notesBar(sheet);
   statusLine(sheet); sheetGrid(sheet); sheetTabs(sheet); editBar(sheet);
   ...`.
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
| `address.ts` | A1..J20; ranges as a generator; a template-literal `Key` type; a key on another sheet (`COSTS!B2`) and its parts |
| `lexer.ts` | A tokenizer generator; each token knows its column, for errors, and a reference its `$`s |
| `parser.ts` | Recursive descent into a discriminated `Expr`, with binary operators by precedence climbing over a table |
| `values.ts` | `CellError`, the coercions, `compare` |
| `functions.ts` | The library: each function declared with its arity, given `Arg`s (a range's cells and width, or one value; an error arrives as a value) |
| `evaluate.ts` | The evaluator; IF is its special form |
| `format.ts` | `show`, the `fmt` tagged template, the status line |
| `sheet.ts` | `Sheet`: inputs, compiled formulas, `Map<string, Set<string>>` edges both ways; Kahn's algorithm downstream of a change; what it cannot order is checked for cycles. Its `Context` answers other sheets' cells, `touch()` works out what reads them, and `Turns` is shared by a workbook's sheets |
| `language.ts` | `Language`: what a formula reads, what it comes to (perhaps a promise), and how it reads moved; the major setting is which one the Sheet holds |
| `excel.ts` | The Excel language over the modules above; moving a formula token by token |
| `rexx.ts` | The RexxJS language: one interpreter, cells read through its `variableResolver`, the setup script, the app's range functions and query functions in TypeScript, the app's copy rule; `install` gives an interpreter the sheet's functions (shadowing RexxJS's own GROUP_BY) |
| `query.ts` | The app's queries with no sheet and no language: rows under perhaps a header row, where (the condition a callback), pluck, group by, sum, avg, count, result |
| `rexxjs.js` | RexxJS itself, generated by `tools/bundle-rexxjs.mjs` from `vendor/rexxjs` (its 61 modules, and `patches/`) |
| `file.ts`, `samples.ts` | The Tauri app's sheet file format (its three cell shapes), and its three sample sheets |
| `numfmt.ts` | Excel's number-format language |
| `dates.ts`, `finance.ts` | Date arithmetic on serial numbers, and the money functions' arithmetic |
| `whatif.ts` | The secant method, text split for Text to Columns, the rows Remove Duplicates keeps |
| `charts.ts` | Chart data from a range, a round scale, bar, line and pie charts as shapes; sparklines |
| `rules.ts` | Conditional-format rules, and what each cell gets from them |
| `notes.ts`, `formats.ts` | A cell's comment, format, style and conditional style; number formats and styles in the app's dialects, as the grid draws them |
| `shift.ts` | Edits that move references (a copy's offset, rows or columns inserted or deleted), which each language's `rewrite` applies to a formula; `restructured` moves a sheet's cells by one |
| `sortfind.ts` | Sorting a range by a column (and where each cell went, for notes), find and replace |
| `commands.ts` | The seam: the catalogue of commands, the command line, the journal, scripts |
| `workbook.ts` | The sheets (each a Sheet and its notes), the active one, both languages, the file's name and setup script, the clipboard, conditional styles; `settle()` passes changes between sheets; what a cell shows, its style, its status line |
| `script.ts` | RexxJS scripts over the commands: ADDRESS SHEET, SETCELL, GETCELL, the app's control functions, and ADDRESS SPREADSHEET (each string REXX, as the app's control bus runs it) |
| `control.ts` | The Tauri app's control functions by its names (INSERTROW, SETFORMAT, GETSHEETNAMES ...), each over an `exec` of demo 18's commands; `MISSING`, those with no command yet and what each needs; LISTCOMMANDS |
| `audit.ts` | The formula printer, and Evaluate Formula's steps |
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
  - `sheet_sheets` (16): sheets added, activated and deleted by command,
    and refused; Excel and RexxJS formulas reading another sheet and
    following it; `#REF!` for a sheet not there; copies, and rows inserted
    here and there; the journal replayed.
  - `sheet_context` (14): below the workbook: qualified references lexed,
    parsed and read in each language, edits moving only the references
    they are for, and a Sheet against a stubbed `Context` (another sheet's
    values, `touch`, sheets sharing `Turns` taking turns).
  - `sheet_files` (18): the file written in the Tauri app's shapes and
    read back (rules, names, other sheets); save, open, list and delete
    against a fake store that holds keys to `storage`'s rule; CSV out of
    a range or everything used, in at a cell, refused where it does not
    fit; New.
  - `sheet_audit` (20): the printer and its parentheses; Evaluate
    Formula's steps (references, ranges as arrays, order, IF, text,
    another sheet, an error); traces a level at a time and across sheets,
    removed; Show Formulas; the Watch Window, across sheets and after one
    goes.
  - `sheet_numfmt` (20): every part of Excel's number-format language
    (sections, colours, conditions, literals, placeholders, commas,
    percent, scientific, fractions, General, text, dates and times), and
    formats.ts telling it from the app's dialect.
  - `sheet_rules` (22): each kind of rule against fixed cells (highlights,
    top and bottom, averages, duplicates, colour scales interpolated, icon
    thirds), described; the format.* commands (default and own styles,
    icons in the text, the first rule winning, following an edit, moving
    with rows, saved, deleted, cleared, refused).
  - `sheet_charts` (19): a range read as categories and series, round
    scales, bar, line and pie layouts (bars in proportion on one
    baseline, lines rising, slices and their shares), sparklines; the
    chart.* commands and insert.sparkline in both languages.
  - `sheet_lookup` (20): the conditionals, XLOOKUP and XMATCH in every
    mode, HLOOKUP, the *IFS family, SUMPRODUCT, and the order statistics,
    with their errors.
  - `sheet_dates` (14): the date and time functions, and the money
    ones against Excel's documented examples (the solvers' roots checked
    by bisection).
  - `sheet_let` (12): LET's scoping, LAMBDA called at once and by name,
    closures, the errors, what it reads, printing, and a copy that moves
    references but not names.
  - `sheet_arrays` (20): arrays from ranges and operators (broadcast,
    `#N/A`), IF over one, every array function, the LAMBDA helpers; in a
    sheet, spilling, `A1#`, a blocker and its clearing, undo, the edge, a
    spill that shrinks, a copy, styles.
  - `sheet_whatif` (14): the secant method, splitting, distinct rows;
    Goal Seek (reached, undone, unreachable, refused), one- and
    two-input data tables, Remove Duplicates by every column and by
    chosen ones, Text to Columns and its refusals.
  - `sheet_look` (14): the dialects' words for italic, underline, sizes,
    borders and wrapping; a look as the grid's style; format.font, .border
    and .wrap; Paste Special and Clear formats; a file; a comment's corner
    and tooltip; data bars.
  - `sheet_rows` (11): rows and columns hidden and shown, moving with
    inserted and deleted rows; AutoFilter by number and text, its rows
    apart from those hidden by hand; refusals; frozen rows; per sheet;
    saved.
  - `sheet_merge` (10): merges (the others cleared, centred, replacing
    what they overlap, unmerged, refused), moving with rows; row heights;
    saved.
  - `sheet_typing` (8): the references a formula names in each language
    (as far as it lexes), where the caret may take one, the outlines
    drawn and cleared.
  - `sheet_query` (21): queries alone (headers found as the app finds
    them, a column by name, letter or index, where, pluck, group by and
    the aggregates); then in RexxJS formulas, spilled: WHERE's condition in
    RexxJS over a row's columns (by name, `column_C`, Rexx's functions),
    GROUP_BY with SUM, COUNT, AVG, PLUCK, RESULT, following an edit, an
    unknown column's why and a bad condition's `#ERROR!`; tables defined
    (by a header row or named columns), read by TABLE in any case,
    refused, moved with an inserted row, saved and read back, deleted; and
    a script's GROUP_BY the sheet's.
  - `sheet_control` (17): each control function against a stubbed `exec`
    (the command it tells and its parameters, what it gives from the
    answer, arguments as the app takes them, refusals); every name in the
    app's LISTCOMMANDS here, missing or a script's own; LISTCOMMANDS; then
    through a Workbook (`cell.about`, `sheet.state`, a script by the app's
    names, a missing one, ADDRESS SPREADSHEET's RC and RESULT); and the
    app's `test-spreadsheet-address.rexx` (in `lower/tests/mod/lib/`),
    unchanged but for its ADDRESS line, every command RC 0, its cells and
    formats as it says.
  - `sheet_csv` (7): RFC 4180 out and back, CRLF, quoted line breaks, and
    its two errors.
  - `sheet_names` (12): names defined, read in both languages, followed,
    deleted to `#NAME?`, refused, listed, journaled.
  - `sheet_rexx` (25): RexxJS formulas against a stub of the cells (what a
    formula reads, Rexx's operators and functions, errors, the setup
    script, every range function, the copy rule), then the Tauri app's two
    sample sheets through a Sheet, each cell at the value the file stored.
  - `sheet_copy` (26): moving formulas (relative, `$`-fixed, ranges, off
    the sheet, kept as typed), copy as text, paste from the sheet and from
    elsewhere, fill down and right.
- **In the browser** (`tests/run_all.sh spec_sheet`, 45 tests, on GTK4
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
    and GETCELL, and its changes undone;
  - sheets as tabs: one added, a RexxJS formula reading it and following
    it, and `#REF!` when it is deleted;
  - Save, New and Open through the page's storage (`$SAE_STORAGE_DIR`, a
    fresh one per run), formats and conditional styles kept; CSV imported
    at a cell and exported from a selection;
  - auditing: traces in blue and orange, Evaluate formula's steps, a
    watch that follows an edit and is removed, Show formulas on and off;
  - conditional formatting: a highlight and an icon set over a
    selection, listed, then cleared; an Excel format's `[Red]` negative
    section;
  - a bar chart of a selection, read back from the vg scene (its
    categories, its palette), its scale following an edit; a sparkline;
    the chart deleted;
  - a dynamic array spilling, read whole by `F14#`, blocked and cleared;
  - Goal seek, Text to columns and Remove duplicates from the data bar;
  - a look (Ctrl+I, underline, borders, wrapping), a comment's corner and
    tooltip, and data bars, read back from the grid;
  - a filter, a column hidden and unhidden, a row frozen;
  - Merge & center drawn as one centred cell two columns wide, Unmerge, a
    row set to a height;
  - point mode: `=` typed, a click on H10 putting `=H10` in, H10 outlined,
    the focus back in the editor, entered;
  - the query functions: a sheet added, RexxJS formulas, data set by a
    script, a table defined from the command bar, `TABLE |> GROUP_BY |>
    SUM` spilled and `WHERE |> COUNT`, both following an edit;
  - the app's control functions in a script: ADDRESS SPREADSHEET strings
    with RC and RESULT, HIDECOLUMN and the getters by name, a currency
    format drawn, LISTCOMMANDS('missing'), and a missing one's message.

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

## Picking this up (a handover)

This document is the plan for demo 18. It is written so that someone with
none of the conversation behind it (another Claude, on another machine, or
a person) can carry on: what is done is above, what comes next and how to
go about it is here. Keep it current in the same commit as each change.

**Where the work is.** On the branch `claude/spreadsheet-demo-todo-472igg`
(commit and push to it as each piece lands; `main` is behind it and gets
it by merge when Paul or Nic say so). The aether-ui pin is `08e3193d`
(`pins`); the Aether pin 0.801.0.

**How the code is laid out** (more under "How it is built"):

- `site/sheet.ts`, the page: a list of panels, nothing else.
- `site/sheet/view/*.ts`, the panels: widgets bound to state, handlers
  that run commands through `SheetView.run` and nothing else.
- `site/sheet/commands.ts`, the seam: every action is a command
  (`cell.set cell=A1 input=5`), with string parameters, an Outcome, a
  journal; `ADDRESS SHEET "..."` and `SETCELL`/`GETCELL` in RexxJS scripts
  (`script.ts`) and the specs drive the same commands.
- `site/sheet/workbook.ts` and the model modules under it (`sheet.ts`, the
  two languages `excel.ts` and `rexx.ts`, `functions.ts`, `evaluate.ts`,
  `notes.ts`, `rules.ts`, `charts.ts`, `numfmt.ts`, `file.ts` ...): no
  `ui` at all.

**How a feature lands** (every one so far has gone this way):

1. A headless test first, `lower/tests/mod/sheet_<thing>.ts`, with
   `// expect: ok ...` lines: the model's pure functions, then the commands
   through a `Workbook` and `Commands` (a fake or stub where a collaborator
   is outside, e.g. the `Store` in `sheet_files`). Run `lower/run-tests.sh`.
2. The model, then the command(s) in `commands.ts`, until it passes.
3. A panel (or a button on one) in `site/sheet/view/`, and an `it` in
   `tests/spec_sheet.ae` that drives it as a person would, through
   `tests/lib/griddriver.ae`'s verbs. Run
   `tests/run_all.sh spec_sheet` (about two minutes; Xvfb on Linux).
4. This document (what it is, how it is tested, the counts), `AGENTS.md`'s
   lowerer test count and spec_sheet line, then commit and push.

**Traps met so far:**

- The browser embeds the lowerer: a change to `lower/module.ae` needs
  `./build.sh` and `AETHER_UI_WITH_DRIVER=1 ./build.sh` (as well as
  `target/saelower` for the headless tests) before a spec sees it.
- `spec_sheet`'s `it`s run in order on one page, each leaving the sheet as
  the next expects; a new `it` goes at the end, on cells nothing else uses
  (rows 14 to 20 and columns H to J are where the later ones work).
- A cell scrolled out of view cannot be clicked: `g.goto("C1")` selects
  through the Name Box, which scrolls it in; then `g.pick` focuses the
  grid for keys. A taller row (wrapping, a height) means fewer rows show.
- The driver reports centred text as `"anchor":"middle"`; a frozen row's
  cells have the class `aui-grid-frozen`, not `aui-grid-cell`;
  `/window/key?combo=Return` does not commit an editor, but
  `/widget/{id}/submit` does. `griddriver`'s `cell_id` finds a cell by its
  `a11y_header` and `a11y_row`, so none of that fools it.
- A click on a cell while editing commits the editor before the page hears
  of the click (point mode holds that commit back: `view/grid.ts`).
- `pkill -f spec_sheet` matches the shell running it: stop a stuck spec by
  killing `sae-driver` and `pageserver` only.
- Storage keys are letters, digits, `.`, `_` and `-` only (`file.ts`
  encodes a file's name into one).
- The lowerer refuses TypeScript that is not erasable: parameter
  properties (`constructor(readonly q: Query) {}`) and enums. Write the
  field and assign it.
- RexxJS looks among its own built-ins before the functions it is given,
  and some built-ins take their arguments through a
  `NAME_positional_args_to_named_param_map` converter. A sheet function
  with a built-in's name (GROUP_BY) never ran until `rexx.ts`'s `install`
  removed the built-in; give an interpreter functions through `install`.
- RexxJS converts a plain object holding arrays as it passes along a
  pipe; a class instance passes as it is (`rexx.ts`'s `Piped` and `Rows`,
  as the app's `RangeQuery`).
- In the dialect, `x! / y` (a non-null assertion, then a division) lexed
  as a regular expression until `1088eee`; an older lowerer still does.

**On a Mac:** `spec_sheet` has only run on GTK4 under Xvfb. The first
thing to do on the Mac mini is `./build.sh`, `AETHER_UI_WITH_DRIVER=1
./build.sh`, `lower/run-tests.sh`, `tests/run_all.sh spec_sheet` and
`tests/run_all.sh spec_grid`, and note what differs here.

## To do

What comes next, in order. The first three are in progress as a smaller
plan agreed on 2026-10-13; the rest follow.

### 1. The Tauri app's query functions, and tables (done, but for the last points below)

The app's `public/lib/spreadsheet-functions.js` has a small query language
in RexxJS's pipe syntax:

```rexx
=RANGE("A1:D100") |> WHERE("column_C > 1000") |> GROUP_BY("B") |> SUM("D")
=TABLE("sales") |> WHERE("region = 'West'") |> PLUCK("amount") |> RESULT()
```

`RANGE(ref)` or `TABLE(name)` starts a query; `WHERE(condition)` keeps the
rows for which it holds; `PLUCK(col)` takes one column; `GROUP_BY(col)`
groups; `SUM(col)`, `AVG(col)` and `COUNT()` aggregate (each group's,
after GROUP_BY); `RESULT()` gives the rows. A column is named by its
letter, `column_C`/`col_C`, or (with a header or table metadata) its name.
`TABLE` reads a table's metadata: its range, column names, types and
descriptions (`DEFINETABLE`/`SET_TABLE_METADATA` in the app). The app
works WHERE's condition out by substituting values into the text and
calling JavaScript's `eval`, which sae must never do: here the condition
is an expression in the sheet's own language (RexxJS), each column's name
bound to the row's value.

What landed (`sheet_query`, and the last `it` in `spec_sheet`):

- `site/sheet/query.ts`: a query (rows, headers, groups) and its steps as
  pure functions; WHERE's condition through a callback that works one out
  for a row (so the model does not know the language). Headless tests.
- Tables in the workbook, per sheet: `table.define name= range=
  [headers=1]`, `table.delete`, `table.list`; saved with the file; moved
  with inserted and deleted rows, as charts are.
- The RexxJS functions: a query is a value RexxJS carries between pipe
  steps; the final value a cell shows is RESULT's rows (spilled, as a
  dynamic array) or an aggregate's number.
  Each is a class instance (`Piped`, `Rows`) so RexxJS carries it as is.
- Tables are per sheet in `Sheet` (`defineTable`, which recomputes), the
  commands are `table.define name= range= [headers=1] [columns=a,b,...]`,
  `table.delete name=` and `table.list`; the file holds `tables: [{name,
  range, headers, columns}]`.
- WHERE runs `LET OK = (condition)` on an interpreter of its own per call;
  a name that is no column is an error ("no column price"), not Rexx's
  unset variable; a condition that is not true or false is an error.

Still to do here:

- Excel's structured references over the same tables (`Sales[Amount]`,
  `SUM(Sales[Amount])`) in the Excel language (`excel.ts`'s lexer and
  parser; `compile` is already given the tables).
- The app's table metadata beyond names: column types and descriptions
  (`SET_TABLE_METADATA`).
- A panel for tables (today they are made from the command bar or a
  script), and outlining a table's range on the grid.

### 2. The control-function name table (done, but for the missing names)

What landed (`sheet_control`, and the last `it` in `spec_sheet`):

- `site/sheet/control.ts`: 64 of the app's names over demo 18's commands,
  reached only through `exec(id, params)` (as a panel reaches them); what
  each gives back is what the app's gives ('OK', the content set, 1 or 0,
  a stem).
- Two read-only commands for the getters: `cell.about cell=` (value,
  input, format, comment, wrap, merged range, validation rule) and
  `sheet.state` (name, sheets, hidden rows and columns, frozen rows, row
  heights, can undo or redo). `edit.replace` now outputs its count.
- `script.ts`: every script has the control functions, and
  `ADDRESS SPREADSHEET` runs each string it is sent as REXX on an
  interpreter of its own, setting RC and RESULT, as the app's control bus
  does. SETCELL gives back what it set, as the app's does.
- The app's own `test-spreadsheet-address.rexx` runs unchanged but for its
  `ADDRESS "http://..." AUTH ... AS SPREADSHEET` line (an outside process
  is step 3), on a sheet set to RexxJS formulas. Paul, sole copyright
  holder of the app (AGPL), relicensed that script to MIT for sae
  (2026-10-13); its header says so.

Differences from the app worth knowing: APPLYROWFILTER is demo 18's
AutoFilter over the whole sheet (the first row kept as headers, the
criterion read as COUNTIF reads one, where the app matches a substring in
every row); FREEZEPANES refuses columns; GETROWHEIGHT is 0 for the grid's
own height; SETCELLVALIDATION's text pattern is refused.

Still missing (`MISSING` in `control.ts`, listed by
`LISTCOMMANDS('missing')`, each refusing with what it needs): BATCH_*,
EXPORT and IMPORT, sheet renaming, EVALUATE and RECALCULATE, the setup
script's three, column widths, GETFILTERCRITERIA, moving columns, FILLUP,
FILLLEFT, AUTOFILL, cell editors, auto IDs, table metadata, the table sort
cycle, pivots.

The app's `src/spreadsheet-control-functions.js` has about 100 control
functions (SETCELL, INSERTROW, SORTRANGE, MERGECELLS, FREEZEPANES, ...).
Most are one of demo 18's commands under another name. A table from each
name and its arguments to a command line makes the app's REXX scripts run
against demo 18 unchanged, in scripts (`script.ts`) and through
`ADDRESS SHEET`. Those without a command yet are listed by
`LISTCOMMANDS` as such: pivots, auto IDs (`CONFIGURE_AUTO_ID`,
`GET_NEXT_ID`, `FIND_ROW_BY_ID`, `UPDATE_ROW_BY_ID`), cell editors
(`SETCELLEDITOR`: a dropdown or checkbox in a cell), moving columns,
renaming sheets.

### 3. The external control bus (written up; waiting on a decision)

The app can be driven from another process, ARexx-style: `postMessage` in
a browser, HTTP on `localhost:8083` with a token in Tauri
(`ADDRESS "http://localhost:8083/api/spreadsheet" AUTH "..." AS
SPREADSHEET`). A sae page cannot listen for anything: that is the
sandbox. Two ways it could:

- (a) an app-mode service: an installed app declares
  `capabilities.controlBus` in `app.json`, sae listens on localhost with a
  token, and hands each request to a handler the page registers (as
  `files` and `shell` are app-mode only, declared, and a service);
- (b) page-to-page messages inside sae, through `browserContext`: safer,
  but no outside process can use it.

Either needs a page-API function, a service, an attempt in
`tests/escape/` and a spec. This is a browser-architecture decision, so
(a) is written up with its security rules in `docs/control-bus.md`, for
Paul and Nic to decide on before any code: its section 5 lists the five
decisions. Nothing is built until they are made.

### 4. Undo for everything

Undo takes back cell contents only (each `Sheet` keeps the inputs a change
replaced). Notes, looks, rules, charts, merges, hidden rows, names, tables
and sheets added or deleted are not undone, and each sheet's undo is its
own. A workbook-wide undo of snapshots taken before each journaled command
(GridCraft's idea 4: its copy-on-write snapshots) would cover all of them,
and undo across sheets; the `Sheet`'s own undo would become one part of it.

### 5. A bigger sheet

The app's sheets are 26 x 100. `address.ts` allows columns A to J and two
digit rows: AA-style columns and larger `COLS`/`ROWS` are its regexes and
constants, then the datagrid's size in `view/grid.ts` (it is virtualised,
at most 4,000 cells shown) and anything that loops over every cell.

### 6. Cut, and paste over a larger selection

Ctrl+X (a copy, then a clear of the source on paste) and one copied cell
pasted into each cell of a selection: both small, in `copy.ts` and
`commands.ts`.

### 7. More functions

Scalar functions lifted over arrays (`UPPER(A1:A3)` is `#VALUE!` today: a
lift in `evaluate.ts`'s call, as operators have), named LAMBDAs (a name
for a LAMBDA in the Name Manager, and so recursion), TAKE, DROP,
CHOOSECOLS, VSTACK, HSTACK, and a text batch (TEXT, TEXTBEFORE, TEXTAFTER,
TEXTSPLIT).

### 8. Sheets renamed and moved, names for the workbook

A rename rewrites what reads the sheet (`Costs!B2` in either language);
moving a sheet reorders the tabs; named ranges scoped to the workbook as
well as to a sheet.

### 9. Real files in app mode, and the system clipboard

Each needs a page service (as `storage` is a page API): `files` for an
installed app (a `.json` or `.rexxsheet` the Tauri app opens too, and
`.csv`), and a clipboard with a permission.

The lists below are where these came from, with what has landed struck
through.

**From the Tauri spreadsheet** (RexxJS/example-app-spreadsheet; its model
is `src/spreadsheet-model.js`, its control functions
`src/spreadsheet-control-functions.js`). Each lands in the model with no
`ui` and its checks headless, then on the page with an `it`:

1. ~~Several sheets~~ (done). Still to come: renaming and moving a sheet
   (a rename rewrites what reads it), undo across sheets (each sheet's
   undo is its own, and adding or deleting a sheet is not undone), names
   scoped to the workbook, and a cycle through two sheets found as one
   (settle() passes changes between sheets twenty times, then stops).
2. ~~Saving and opening~~ (done, through `storage`; CSV in a textarea).
   Still to come: `files` in app mode (a `.json` or `.rexxsheet` the app
   can open too, and a `.csv`).
3. ~~The query functions~~ (done: RANGE, TABLE, WHERE in RexxJS, PLUCK,
   GROUP_BY, SUM, AVG, COUNT, RESULT). Still to come: structured
   references in Excel formulas, table metadata.
4. ~~Hide rows and columns, freeze panes, text wrapping, conditional
    formatting, data validation~~ (done; freezing columns at run time
    needs aether-ui). Still to come: validation by pattern, and **auto
    IDs**.
5. ~~The control functions~~ by the app's names in scripts, and ADDRESS
    SPREADSHEET (done; the missing ones are listed above). Still to come:
    a **control bus** for other apps (the app's is HTTP or postMessage;
    sae's would be a page service): the To do's 3.
6. ~~Charts~~ of a range in `vg` (done: bar, line, pie, sparklines). Still
   to come: the app's chart scripts (they drive Chart.js), more kinds
   (area, scatter, stacked), and axis titles.

Not coming over: the DOM itself (React, the DOM functions RexxJS has for
web pages), and Pyodide (NumPy, SciPy, SymPy in WebAssembly).

**From aether-ui `08e3193d`** (`asks/aether-ui-datagrid-rows-and-cells.md`,
landed): in demo 18 now, all of it: the looks, data bars, comment
markers, hidden and frozen rows, AutoFilter, merged cells, row heights,
coloured references and point mode as a formula is typed, and multi-line
fields for CSV and RexxJS scripts.

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
   - Done: lookups, conditionals, order statistics, dates, money.
   - Done too: LET and LAMBDA; dynamic arrays and spilling; MAP, REDUCE,
     SCAN, BYROW, BYCOL, MAKEARRAY.
   - Next: scalar functions lifted over arrays; named LAMBDAs; TAKE, DROP,
     CHOOSECOLS, VSTACK, HSTACK; a text batch (TEXT, TEXTBEFORE,
     TEXTAFTER, TEXTSPLIT).
5. ~~Highlighting what a formula reads while it is typed~~ (done: coloured
   references and point mode). Still to come: Evaluate Formula for RexxJS
   formulas, which needs RexxJS's own expression tree.

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
