# The Tauri spreadsheet on sae: what was found, for its repo

Demo 19 ran the Tauri spreadsheet (RexxJS/example-app-spreadsheet, at
45b0993f) on sae as itself: its `spreadsheet-model.js`,
`spreadsheet-rexx-adapter.js`, `spreadsheet-loader.js` and
`public/lib/spreadsheet-functions.js`, vendored under a `ui.datagrid` view.
It was then folded into demo 18 as pure sae TypeScript, and those files were
removed (they are in git history, under `site/rexxsheet/`, before the
commit that folded them in). What sae keeps from the app: its range
functions, ported to `site/sheet/rexx.ts`; its sample sheets,
`site/sheet/samples.ts`; and its file format, `site/sheet/file.ts`.

Licences: upstream, the example app's `LICENSING.md` puts the model,
adapter and loader under the AGPL v3. Their copyright holder, Paul Hammant,
relicensed the copy in sae to MIT (2026-10-11), so what demo 18 takes from
the app is MIT, as are RexxJS (`vendor/rexxjs/LICENSE`) and sae itself.

The fixes below were made in that vendored copy, each marked `// sae:`
there, and are bugs in the app as it stands: they belong in its repo.

## Bugs found, and their fixes

The first four are bugs in the app as it stands; the last two were
adaptations to sae. Demo 18's own model has none of the four: its Sheet
evaluates in dependency order, one cell at a time, finds cycles, and is
awaited (`lower/tests/mod/sheet_sheet.ts`, `sheet_rexx.ts`).

1. **`spreadsheet-loader.js`, `importIntoModel`: setCell gets the adapter.**
   It was given `adapter.interpreter`, but setCell calls `.evaluate()` on
   what it is given, which only the adapter has: every formula in a loaded
   file came to `#ERROR!` ("not a function"). SpreadsheetApp's own edits
   pass the adapter. It also now `await`s each setCell.
2. **`spreadsheet-rexx-adapter.js`, `evaluate`: evaluations take turns.**
   One interpreter holds every cell's `CELLRESULT`, so two evaluations at
   once (any caller that does not await setCell, such as the loader) read
   each other's results: the test sheet's A4 showed C3's 15.
3. **`spreadsheet-rexx-adapter.js`, `evaluate`: `commands.length <= 1`.**
   An expression of constants alone (`2*3`, `1/0`) parses to no commands, so
   it was run as a statement and the cell showed nothing (and `1/0` no
   error).
4. **`spreadsheet-model.js`: cycles, and setCell's order.**
   `propagateChanges` followed dependents with no record of its path, so a
   cycle (`F1 = F2`, `F2 = F1 + 1`) recursed until the stack ran out; it now
   carries the path, and marks each cell on a cycle `#CIRCULAR!` with the
   route (`Circular reference: F2 → F1 → F2`). And setCell started the
   cell's evaluation and its dependents' together, so a dependent could read
   the old value; it now returns a promise of the cell evaluated, then its
   dependents (callers that ignored the return are unaffected;
   SpreadsheetApp already awaits it).
5. **`spreadsheet-rexx-adapter.js`: `parse` is imported** from `./rexxjs.js`
   (in a browser it was a global from `rexxjs.bundle.js`).
6. **`spreadsheet-functions.js`: `useAdapter` and `SPREADSHEET_FUNCTIONS`.**
   A page has no `window`: the library takes its adapter from `useAdapter`,
   and its functions are exported as one object, which `boot.ts` puts in
   the interpreter's `externalFunctions`.

RexxJS core needed two changes. They were patches in `vendor/rexxjs/patches/`
until 2026-10-13, and are now upstream: RexxJS `88eefca`, with their jest
specs in `core/tests/` (`comparisons-in-expressions.spec.js`,
`expressions-as-function-arguments.spec.js`; jest +12 passing, dogfood
41/41). `vendor/rexxjs` is re-vendored from that commit with no patches, and
the bundle is byte-for-byte what the patched one was.

1. Comparisons in expressions: a comparison in an expression is now
   one. `LET X = B2 > 500` read `B2` as a function call, and
   `LET X = (B2 > 500)` came to B2's value, as parentheses dropped what
   followed their inner sum. Comparisons are the loosest operators, come to
   1 or 0, and take every Rexx spelling (`=`, `\=`, `<>`, `><`, `!=`, `¬=`,
   `==`, `\==`, `>`, `<`, `>=`, `<=`); `=` stays a named parameter in a call
   such as `ARRAY_FILTER array=mixed`.
2. Expressions as function arguments: a function's arguments were
   kept as text and resolved as a literal, a number or a name, so one with
   an operator was never worked out: `MAX(B + 1, 2)` came to 2,
   `ABS(B - 3000)` to 0, and an external function was handed the text
   `"B<0"` (so the app's `STYLE_IF(C5 < 0, ...)` always took its first
   branch). Such an argument is now parsed as an expression, `||` as LET's
   concatenation; named arguments (`delimiter=","`) and arrow functions
   stay as they were.
