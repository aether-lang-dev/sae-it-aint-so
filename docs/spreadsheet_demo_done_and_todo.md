# The spreadsheet demo: done, and still to do

Demo 18 (`docs/roadmap.md`), `site/sheet.ts`, as of 2026-10-11, pinned to aether-ui `e50baa53`. It began as the third of five
demo ideas meant to show off sae's TypeScript dialect, and grew into the
sae page that uses the most of the page API.

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

**The formula language:**

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

The model has no `ui`, and is about 1,000 lines of dialect in `site/sheet/`:

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
| `copy.ts` | A formula moved (its references rewritten token by token, so the rest stays as typed); copy as tab-separated text; paste, moving formulas when the text came from the sheet; fill down and right. Gives `[key, input]` pairs for `Sheet.setMany` |

`site/sheet.ts` (about 220 lines) is the view: the datagrid's functions read
the `Sheet`, and its edits go back through it.

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
  - `sheet_evaluate` (28): operators, coercions, errors as values,
    formatting.
  - `sheet_functions` (46): every function, its edge cases and its errors,
    against a fixed set of cells.
  - `sheet_sheet` (26): the `Sheet` against a recording mock listener.
    Edits ripple in dependency order; a paste recomputes each cell once;
    cycles are found and mended; a formula forgets what it used to read.
  - `sheet_copy` (26): moving formulas (relative, `$`-fixed, ranges, off
    the sheet, kept as typed), copy as text, paste from the sheet and from
    elsewhere, fill down and right.
- **In the browser** (`tests/run_all.sh spec_sheet`, 17 tests, on GTK4
  under Xvfb):
  - formulas, ripples, parse errors in red, cycles, the paste;
  - lookups, conditionals and IFERROR on the example;
  - an in-cell edit that opens on `=B2*C2` and ripples into D5;
  - the grid's keys, a grip drag, a grip double-click that fits;
  - Ctrl+D and Ctrl+R; Ctrl+C and Ctrl+V moving `=$B$2+C2` to
    `=$B$2+D4`; Delete over a selection, and not while the formula field
    has the focus; and Clear all.

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

**Spreadsheet behaviour:**

1. **The system clipboard.** Copy and paste work within the sheet only.
   Copying out to other apps, and pasting in from them, needs a clipboard
   API for pages: a page service with a permission, like `files`. Text
   pasted from elsewhere would go through `pasted()` with no `from`, so its
   formulas are taken as written.
2. **Cut, and paste over a larger selection.** Ctrl+X (a copy, then a
   clear of the source on paste) and a one-cell copy pasted over a range
   (repeated into each cell) are both small, in `copy.ts`.
3. **Undo and redo.** `Sheet.setMany` is already the one place every change
   goes through, so an undo stack is the inputs it replaced.
4. **A bigger sheet.** The grid is virtualised (4,000 cells shown at once),
   but `address.ts` allows only columns A to J and two-digit rows. AA-style
   columns and larger limits are the address regexes plus `COLS`/`ROWS`.
   Recompute already touches only what is downstream of a change.
5. **Saving.** Per-origin storage in the browser, or `sqlite.<name>` in
   app mode: one row per non-empty input. The page would load it before
   the first refresh.
6. **Number formats.** Per-column or per-cell currency, percentages and
   fixed places, applied in `show()` and chosen by a picker. `cell_style`
   already carries the alignment.
7. **More functions.**
   - Dates need a clock, which pages get coarse (sae's web rules), so
     TODAY and NOW would read the coarse clock.
   - HLOOKUP, XLOOKUP, SUMPRODUCT, COUNTIFS and SUMIFS, and ROUND's
     siblings.
   - Each is a `def()` plus checks in `sheet_functions.ts`.
8. **Highlighting what a formula reads.** While a formula is being edited,
   the cells it references could take a `cell_style` background; the
   parser already gives `refsOf`.
9. **Charts.** A `vg` bar or line chart of a selected range, redrawn on
   change, would put the grid and `vg` on one page.

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
