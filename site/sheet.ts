// Spreadsheet (docs/roadmap.md demo 18): a 10 x 20 sheet with formulas.
// site/sheet/ is the language and the model, with no ui: a tokenizer
// generator, a recursive-descent parser into a union AST, an evaluator whose
// errors are values, and a Sheet that keeps who-reads-whom and recomputes
// downstream in order, finding cycles. This page is the view: the cells are
// buttons the Sheet's listener captions; the formula bar, status line,
// problem list and summary are state, bind (two-way for the fields),
// computed and each; a paste is one batch.
import { COLS, ROWS, addrOf, colName, keyOf } from "./sheet/address.ts";
import { Sheet, pasted } from "./sheet/sheet.ts";
import type { Problem } from "./sheet/sheet.ts";
import { describe, show } from "./sheet/format.ts";

const { text, btn, textfield, grid, hstack, styles, add_class } = ui;

const EXAMPLE = [
  "Item\tQty\tPrice\tTotal",
  "Apples\t6\t0.45\t=B2*C2",
  "Bread\t1\t2.2\t=B3*C3",
  "Milk\t2\t1.15\t=B4*C4",
  "Total\t=SUM(B2:B4)\t\t=SUM(D2:D4)",
  "Average\t\t=AVERAGE(C2:C4)\t=ROUND(D5/B5, 2)",
].join("\n");

const cells = new Map<string, number>();     // key -> its button
const sheet = new Sheet({ changed: (key, value) => ui.set_text(cells.get(key)!, show(value)) });

const address = state("A1");
const input = state("");
const status = state("");
const problems = state<Problem[]>([]);
const summary = computed(() => {
  const n = problems.value.length;
  return n === 0 ? "No problems" : `${n} problem${n === 1 ? "" : "s"}`;
}, problems);

// The address field drives the formula field: name a cell, see what it holds.
address.subscribe((a: string) => {
  const at = addrOf(a);
  if (!at) return;
  const key = keyOf(at);
  batch(() => {
    input.set(sheet.input(key));
    status.set(describe(key, sheet.input(key), sheet.value(key)));
  });
});

const settled = (key: string) => {
  problems.set(sheet.problems());
  status.set(describe(key, sheet.input(key), sheet.value(key)));
};

const enter = () => {
  const at = addrOf(address.value);
  if (!at) {
    status.set(`${address.value}: not a cell on this sheet`);
    return;
  }
  const key = keyOf(at);
  batch(() => {
    sheet.set(key, input.value.trim());
    address.set(key);
    settled(key);
  });
  print(`sheet: ${key} = ${show(sheet.value(key))}`);
};

// Many cells at once (a paste, a clear): one recompute, one batch.
const setAll = (entries: readonly (readonly [string, string])[], what: string) => {
  let changed: string[] = [];
  batch(() => {
    changed = sheet.setMany(entries);
    settled(keyOf(addrOf(address.value) ?? { col: 0, row: 0 }));
  });
  print(`sheet: ${what}: ${entries.length} cells set, ${changed.length} changed`);
};

styles({
  "cell.button": { font_size: 11, border_radius: 0 },
  "head.label": { color: 0x6a6f7a, font_size: 11 },
});

text("Spreadsheet");
hstack(() => {
  bind(textfield("cell", () => {}), address);
  bind(textfield("formula", () => {}), input);
  btn("Enter", enter);
});
bind(text(""), status);
grid(COLS + 1, 0, () => {
  const head = (s: string) => add_class(text(s), "head");
  head("");
  for (let c = 0; c < COLS; c++) head(colName(c));
  for (let row = 0; row < ROWS; row++) {
    head(String(row + 1));
    for (let col = 0; col < COLS; col++) {
      const key = keyOf({ col, row });
      const cell = btn("", () => address.set(key));
      add_class(cell, "cell");
      cells.set(key, cell);
    }
  }
});
bind(text(""), summary);
each(problems, "key", (p: Problem) => text(`${p.key}: ${p.message}`));
hstack(() => {
  btn("Paste example", () => setAll(pasted(EXAMPLE, { col: 0, row: 0 }), "pasted the example"));
  btn("Clear all", () => setAll(sheet.keys().map((k) => [k, ""] as const), "cleared"));
  btn("Home", () => browserContext.changePage("/"));
});
