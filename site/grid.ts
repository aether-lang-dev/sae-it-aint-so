// site/grid.ts -- ui.datagrid: aether-ui's virtualised grid for pages. A
// million rows by 40 columns from a function, 15 rows by 5 columns shown,
// one frozen column of row numbers, a header of column letters; a click
// names the cell, keys move a selection, Return activates it; header drags
// resize and move columns (and so do two buttons); a double click or F2
// edits a cell. Written declaratively: the grid is the receiver of its
// block, as a button is of its own. A second, small grid below keeps the
// first form (a cell function in the block's place). A field and a label
// below take blocks of their own: onsubmit() and ondrag() act on them.
// A third grid has hidden and frozen rows, merges, row heights, styles,
// tooltips and the editor's text as it is typed; a textarea is bound to a
// state. tests/spec_grid.ae drives it.
const { text, btn, textfield, onsubmit, ondrag, pointer_shape, onfocuschange, cells, headers, on_cell_click, on_cell_select, on_cell_activate,
        on_cell_edit, on_col_resize, on_col_move, edit_text, cell_style } = ui;

const letters = (c: number): string => {
  let s = "";
  for (let n = c; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};

const edits: { [k: string]: string } = {};

text("Grid");
const picked = text("picked: none");
const g = ui.datagrid(1000000, 40, 15, 5, 1, () => {
  // "=a+b" is a formula: the cell shows its sum, an editor holds the formula.
  const shown = (raw: string): string =>
    raw.startsWith("=") ? String(raw.slice(1).split("+").reduce((t, n) => t + Number(n), 0)) : raw;
  cells((r: number, c: number) =>
    c === 0 ? String(r + 1) : (edits[`${r},${c}`] !== undefined ? shown(edits[`${r},${c}`]) : `${letters(c - 1)}${r + 1}`));
  edit_text((r: number, c: number) => edits[`${r},${c}`] ?? `${letters(c - 1)}${r + 1}`);
  // Row 3's column B is an alarm; a formula's value sits at the right.
  cell_style((r: number, c: number) =>
    r === 2 && c === 2 ? "background: #ffe0e0; color: #b00000; font-weight: bold"
      : (edits[`${r},${c}`] ?? "").startsWith("=") ? "text-align: end" : "");
  headers((c: number) => (c === 0 ? "#" : letters(c - 1)));
  on_cell_click((r: number, c: number) => {
    ui.set_text(picked, `picked: ${r},${c}`);
    print(`grid picked ${r},${c}`);
  });
  on_cell_select((r: number, c: number) => {
    const [ar, ac] = ui.datagrid_selection(g);
    print(`grid selected ${ar},${ac} to ${r},${c}`);
  });
  on_cell_activate((r: number, c: number) => print(`grid activated ${r},${c}`));
  on_cell_edit((r: number, c: number, t: string) => {
    edits[`${r},${c}`] = t;
    print(`grid edited ${r},${c} = ${t}`);
  });
  on_col_resize((c: number, w: number) => print(`grid resized ${c} to ${w}`));
  on_col_move((from: number, to: number) =>
    print(`grid moved ${from} to ${to}; view ${to} shows model ${ui.datagrid_col_model(g, to)}`));
});
btn("Widen B", () => {
  ui.datagrid_set_col_width(g, 2, 150);
  print(`grid B is ${ui.datagrid_col_width(g, 2)} wide`);
});
btn("Move B to E", () => ui.datagrid_move_col(g, 2, 5));
btn("Fit A", () => {
  ui.datagrid_fit_col(g, 1);
  print(`grid A fitted to ${ui.datagrid_col_width(g, 1)}; "A1" measures ${ui.text_measure(picked, "A1")}`);
});
btn("Select B2:D5", () => ui.datagrid_select_range(g, 1, 2, 4, 4));
btn("To row 500000", () => {
  ui.datagrid_scroll_to(g, 499999, 10);
  const [r, c] = ui.datagrid_first(g);
  print(`grid first ${r},${c}`);
});
// The first form: a cell function where the block goes, and the
// ui.datagrid_* setters by handle (each returns the grid).
const small = ui.datagrid(3, 2, 3, 2, 0, (r: number, c: number) => `s${r}${c}`);
ui.datagrid_header(ui.datagrid_set_col_widths(small, 60), (c: number) => `S${c}`);
textfield("note", (s: string) => {}, () => {
  onsubmit((t: string) => print(`note submitted ${t}`));
  onfocuschange((inside: number) => print(`note focus ${inside}`));
});
print(`key_text comma is ${ui.key_text("comma")}`);
text("drag me", () => {
  pointer_shape("grab");
  ondrag((phase: number, x: number, y: number) => {
    if (phase === 2) print(`dragged by ${x},${y}`);
  });
});
// A third grid for the rows and cells API: hidden rows, frozen rows,
// merges, row heights, styles past colour and bold, tooltips, and the
// editor's text as it is typed (ui.datagrid_on_edit_change, _edit_insert).
const rows = ui.datagrid(8, 4, 6, 3, 1, (r: number, c: number) => (c === 0 ? String(r + 1) : `n${r}:${c}`));
ui.datagrid_cell_style(rows, (r: number, c: number) => (r === 0 && c === 1
  ? "font-style: italic; text-decoration: underline; border-bottom: 2px solid #ff0000; --fill: 0.5; --fill-color: #638ec6; --corner: #d00000"
  : r === 7 && c === 1 ? "white-space: normal" : ""));
ui.datagrid_cell_tooltip(rows, (r: number, c: number) => (r === 0 && c === 1 ? "a note" : ""));
ui.datagrid_on_edit(rows, (r: number, c: number, t: string) => print(`rows edited ${r},${c} = ${t}`));
ui.datagrid_on_edit_change(rows, (t: string, caret: number) => print(`rows typing ${t} @${caret}`));
btn("Hide row 2", () => {
  ui.datagrid_hide_row(rows, 1, 1);
  print(`rows: shown row 1 is model row ${ui.datagrid_row_model(rows, 1)}`);
});
btn("Freeze a row", () => ui.datagrid_freeze_rows(rows, 1));
btn("Merge", () => {
  ui.datagrid_merge(rows, 3, 1, 2, 2);
  print(`rows: merged ${ui.datagrid_merge_of(rows, 4, 2)}`);
});
btn("Unmerge", () => {
  ui.datagrid_unmerge(rows, 3, 1);
  print(`rows: merge of 4,2 is "${ui.datagrid_merge_of(rows, 4, 2)}"`);
});
btn("Tall rows", () => {
  ui.datagrid_set_row_height(rows, 0, 48);
  ui.datagrid_fit_row(rows, 7);
  print("rows: heights set");
});
btn("Insert X1", () => ui.datagrid_edit_insert(rows, "X1"));
// ui.textarea: several lines, bound both ways to a state.
const story = state("");
bind(ui.textarea("story"), story);
bind(ui.text(""), computed(() => `story has ${story.value.split("\n").length} lines`, story));
btn("Two lines", () => story.set("one\ntwo"));
btn("Home", () => browserContext.changePage("/"));
