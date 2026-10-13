# Ask (aether-ui): the datagrid's rows, and more in a cell

**Landed**, all seven, in aether-ui `94fee594` .. `08e3193d`; sae pins
`08e3193d` and gives pages each (`ui.datagrid_hide_row` and the rest, and
`ui.textarea`: README's page API, `site/grid.ts`, `spec_grid`). As landed:
rows are model rows everywhere; columns stay view columns (a hidden one
stays hidden when moved); the driver reads styles back as `fontStyle`,
`textDecoration`, `borderTop` (and the other sides), `bar`, `barColor`,
`corner` and `tooltip`, and a hidden row's cells show no text; a merge's
click reports its top-left, and its text sits in its top row; taller rows
mean fewer rows shown; `on_edit_change` is heard on the next turn of the
loop (so the caret is after the new text), in UTF-16 units on AppKit,
UIKit, Windows and Android and characters on GTK. (On GTK 4.6 an underline
is faint at the default size; 4.22 draws it properly.)

sae's spreadsheet (demo 18, `docs/spreadsheet_demo_done_and_todo.md`) now
has everything GridCraft's audit (`docs/gridcraft-audit.md`) put before
these, each a command under the page. What is left of Excel's grid needs
the datagrid. In the order the spreadsheet would use them:

## 1. Hidden rows and columns

AutoFilter, Group/Outline, Hide/Unhide and the Tauri spreadsheet's row
filter all need them.

```aether
datagrid_hide_row(g, r, hidden)   // a model row out of the view, or back
datagrid_hide_col(g, c, hidden)
datagrid_row_model(g, view_row)   // as datagrid_col_model, for rows
```

A hidden row takes no height; scrolling, the cursor keys, Shift-extended
selections and `datagrid_select_range` skip it, and the row header shows
the gap (Excel draws a double line). `datagrid_selection` and the click
callbacks keep giving model rows and columns, so a page's code does not
change.

## 2. Frozen rows

```aether
datagrid_freeze_rows(g, n)        // the leading n rows stay while it scrolls
```

As the frozen columns are: not in what scrolls, `aui-grid-frozen`, drawn
`#f2f2f5`. Freeze Top Row and Freeze Panes are this and the columns.

## 3. More of a style

`cell_style` drawing, besides what it draws now:

- `font-style: italic`, `text-decoration: underline` and `line-through`,
  `font-size: 14px`;
- borders: `border-bottom: 1px solid #000` (and top, left, right; `border`
  for all four), drawn on the cell's edge;
- a fill fraction behind the text, for data bars:
  `--fill: 0.42; --fill-color: #638ec6` (from the cell's start edge, or
  from its end when negative, as Excel's are);
- a corner marker, for a cell with a comment: `--corner: #d00`, with
  `datagrid_cell_tooltip(g, fn(r, c) -> string)` to read the comment on
  hover.

The style hash (`asks/aether-ui-datagrid-style-hash.md`) covers these too,
since it hashes the whole string.

## 4. Merged cells

```aether
datagrid_merge(g, r, c, rows, cols)   // one cell drawn over the rectangle
datagrid_unmerge(g, r, c)
```

Its top-left cell's text and style over the whole rectangle; a click
anywhere in it selects it; the cursor keys step over it. Merge & Center,
and the Tauri app's merges.

## 5. Wrapped text and row heights

`white-space: normal` in a cell's style wraps its text;
`datagrid_set_row_height(g, r, h)` and `datagrid_fit_row(g, r)`, as the
columns have.

## 6. The editor's text as it is typed

```aether
datagrid_on_edit_change(g, fn(text: string, caret: int))
datagrid_edit_insert(g, text)     // at the caret, as if typed
```

For point mode (typing `=SUM(`, then clicking a cell inserts its reference)
and for colouring the references a formula being typed names.

## 7. A multi-line text field

`ui.textarea(placeholder, fn)`, bindable as `ui.textfield` is. CSV pasted
in, a RexxJS script of more than one line, a long formula.

## How sae would test them

Each lands on the page as a command (`rows.hide`, `view.freezeRows`,
`format.border`, `cells.merge` ...) with its checks headless
(`lower/tests/mod/sheet_*`), and an `it` in `tests/spec_sheet.ae` that
reads the datagrid back through the driver (`griddriver`'s `cell_has` for
styles; a hidden row as a cell the widget tree no longer shows).
