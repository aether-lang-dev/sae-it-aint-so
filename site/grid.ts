// site/grid.ts -- ui.datagrid: aether-ui's virtualised grid for pages. A
// million rows by 40 columns from a function, 15 rows by 5 columns shown,
// one frozen column of row numbers, a header of column letters; a click
// names the cell, keys move a selection, Return activates it; header drags
// resize and move columns (and so do two buttons).
// tests/spec_grid.ae drives it.
const { text, btn } = ui;

const letters = (c: number): string => {
  let s = "";
  for (let n = c; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};

text("Grid");
const picked = text("picked: none");
const g = ui.datagrid(1000000, 40, 15, 5, 1, (r: number, c: number) =>
  c === 0 ? String(r + 1) : `${letters(c - 1)}${r + 1}`);
ui.datagrid_header(g, (c: number) => (c === 0 ? "#" : letters(c - 1)));
ui.datagrid_on_click(g, (r: number, c: number) => {
  ui.set_text(picked, `picked: ${r},${c}`);
  print(`grid picked ${r},${c}`);
});
ui.datagrid_on_select(g, (r: number, c: number) => {
  const [ar, ac] = ui.datagrid_selection(g);
  print(`grid selected ${ar},${ac} to ${r},${c}`);
});
ui.datagrid_on_activate(g, (r: number, c: number) => print(`grid activated ${r},${c}`));
ui.datagrid_on_col_resize(g, (c: number, w: number) => print(`grid resized ${c} to ${w}`));
ui.datagrid_on_col_move(g, (from: number, to: number) =>
  print(`grid moved ${from} to ${to}; view ${to} shows model ${ui.datagrid_col_model(g, to)}`));
btn("Widen B", () => {
  ui.datagrid_set_col_width(g, 2, 150);
  print(`grid B is ${ui.datagrid_col_width(g, 2)} wide`);
});
btn("Move B to E", () => ui.datagrid_move_col(g, 2, 5));
btn("Select B2:D5", () => ui.datagrid_select_range(g, 1, 2, 4, 4));
btn("To row 500000", () => {
  ui.datagrid_scroll_to(g, 499999, 10);
  const [r, c] = ui.datagrid_first(g);
  print(`grid first ${r},${c}`);
});
btn("Home", () => browserContext.changePage("/"));
