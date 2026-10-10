// site/grid.ts -- ui.datagrid: aether-ui's virtualised grid for pages. A
// million rows by 40 columns from a function, 15 rows by 5 columns shown,
// one frozen column of row numbers, a header of column letters; a click
// names the cell. tests/spec_grid.ae drives it.
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
btn("To row 500000", () => {
  ui.datagrid_scroll_to(g, 499999, 10);
  const [r, c] = ui.datagrid_first(g);
  print(`grid first ${r},${c}`);
});
btn("Home", () => browserContext.changePage("/"));
