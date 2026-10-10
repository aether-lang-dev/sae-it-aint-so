// Spreadsheet (docs/roadmap.md demo 18): a 10 x 20 sheet with formulas.
// site/sheet/ is the language and the model, with no ui: a tokenizer
// generator, a recursive-descent parser into a union AST, an evaluator whose
// errors are values, and a Sheet that keeps who-reads-whom and recomputes
// downstream in order, finding cycles. This page is the view: the grid is a
// vg scene (GridView) whose columns are groups, so dragging a column's
// header border resizes it and slides the columns after it; the formula
// bar, status line, problem list and summary are state, bind (two-way for
// the fields), computed and each; a paste is one batch.
import { COLS, ROWS, addrOf, colName, keyOf } from "./sheet/address.ts";
import { Sheet, pasted } from "./sheet/sheet.ts";
import type { Problem, SheetListener } from "./sheet/sheet.ts";
import { describe, show } from "./sheet/format.ts";
import { names } from "./sheet/functions.ts";
import { Columns, HEAD, PAD, ROW, ROW_HEAD, cellAt, fit, height, rowTop } from "./sheet/layout.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";

const { text, btn, textfield, hstack } = ui;

const EXAMPLE = [
  "Item\tQty\tPrice\tTotal",
  "Apples\t6\t0.45\t=B2*C2",
  "Bread\t1\t2.2\t=B3*C3",
  "Milk\t2\t1.15\t=B4*C4",
  "Total\t=SUM(B2:B4)\t\t=SUM(D2:D4)",
  "Average\t\t=AVERAGE(C2:C4)\t=ROUND(D5/B5, 2)",
].join("\n");

const WIDTH = 760;                // the scene; columns widened past it are cut off
const INK = "#20232a", ERROR = "#c0392b", LINE = "#d0d4dc", HEAD_FILL = "#eceef2";

// The grid, drawn in vg. Each column is a group translated to its left
// edge: a resize changes that column's widths and slides the groups after
// it. The Sheet tells it what each cell shows; it keeps the full text so a
// narrower column can cut it and a wider one show it again.
class GridView implements SheetListener {
  readonly #cols = new Columns();
  readonly #groups: number[] = [];
  readonly #heads: number[] = [];
  readonly #letters: number[] = [];
  readonly #handles: number[] = [];
  readonly #rects: number[][] = [];
  readonly #texts: number[][] = [];
  readonly #full = new Map<string, string>();
  #outline = 0;
  #selected = "A1";

  build(pick: (key: string) => void): void {
    const cols = this.#cols;
    vg.scene(`0 0 ${WIDTH} ${height}`, WIDTH, height, () => {
      vg.rect(0, 0, WIDTH, height, () => {
        vg.fill("#ffffff");
        vg.on_click((x: number, y: number) => {
          const at = cellAt(cols, x, y);
          if (at) pick(keyOf(at));
        });
      });
      vg.rect(0, 0, ROW_HEAD, height, () => { vg.fill(HEAD_FILL); vg.stroke(LINE, 1); });
      for (let row = 0; row < ROWS; row++) {
        vg.text_anchored(ROW_HEAD - PAD, rowTop(row) + 15, 11, "end", String(row + 1), () => vg.fill("#6a6f7a"));
      }
      for (let c = 0; c < COLS; c++) {
        const w = cols.width(c);
        this.#groups.push(vg.g(() => {
          vg.transform(`translate(${cols.left(c)},0)`);
          this.#heads.push(vg.rect(0, 0, w, HEAD, () => { vg.fill(HEAD_FILL); vg.stroke(LINE, 1); }));
          // The letter in a group of its own, so a resize can re-centre it.
          this.#letters.push(vg.g(() => {
            vg.transform(`translate(${w / 2},0)`);
            vg.text_anchored(0, 14, 11, "middle", colName(c), () => vg.fill("#6a6f7a"));
          }));
          this.#rects.push(Array.from({ length: ROWS }, (_, row) =>
            vg.rect(0, rowTop(row), w, ROW, () => { vg.fill("#ffffff"); vg.stroke(LINE, 1); })));
          this.#texts.push(Array.from({ length: ROWS }, (_, row) =>
            vg.text_sized(PAD, rowTop(row) + 15, 11, "", () => vg.fill(INK))));
        }));
      }
      // Each column's right border has a handle, over every column: drag it
      // to resize the column.
      for (let c = 0; c < COLS; c++) {
        this.#handles.push(vg.rect(cols.right(c) - 3, 2, 6, HEAD - 4, () => {
          vg.fill("#b8bcc6");
          vg.cursor("col-resize");
          vg.tooltip(`Drag to resize column ${colName(c)}`);
          vg.on_drag((x: number) => this.resize(c, x - cols.left(c)));
          vg.on_drag_end(() => print(`sheet: column ${colName(c)} is ${cols.width(c)} wide`));
        }));
      }
      this.#outline = vg.rect(0, 0, 0, 0, () => { vg.fill("none"); vg.stroke("#3366cc", 2); });
    });
    this.select(this.#selected);
  }

  changed(key: string, value: Value): void {
    const { col, row } = addrOf(key)!;
    this.#full.set(key, show(value));
    vg.set(this.#texts[col][row], {
      text: fit(show(value), this.#cols.width(col)),
      fill: value instanceof CellError ? ERROR : INK,
    });
  }

  select(key: string): void {
    this.#selected = key;
    if (this.#outline === 0) return;      // not built yet: build() selects it
    const { col, row } = addrOf(key)!;
    vg.set(this.#outline, { x: this.#cols.left(col), y: rowTop(row), w: this.#cols.width(col), h: ROW });
  }

  resize(c: number, width: number): void {
    const w = this.#cols.resize(c, width);
    vg.set(this.#heads[c], { w });
    vg.set_transform(this.#letters[c], `translate(${w / 2},0)`);
    for (let row = 0; row < ROWS; row++) {
      vg.set(this.#rects[c][row], { w });
      vg.set(this.#texts[c][row], { text: fit(this.#full.get(keyOf({ col: c, row })) ?? "", w) });
    }
    for (let k = c + 1; k < COLS; k++) vg.set_transform(this.#groups[k], `translate(${this.#cols.left(k)},0)`);
    for (let k = c; k < COLS; k++) vg.set(this.#handles[k], { x: this.#cols.right(k) - 3 });
    this.select(this.#selected);
  }
}

const grid = new GridView();
const sheet = new Sheet(grid);

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
  grid.select(key);
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

text("Spreadsheet");
hstack(() => {
  bind(textfield("cell", () => {}), address);
  bind(textfield("formula", () => {}), input);
  btn("Enter", enter);
});
bind(text(""), status);
grid.build((key) => address.set(key));
// The library, ten names a line.
const lines = Array.from({ length: Math.ceil(names().length / 10) }, (_, i) => names().slice(i * 10, i * 10 + 10).join(", "));
text(`Functions:\n${lines.join(",\n")}`);
bind(text(""), summary);
each(problems, "key", (p: Problem) => text(`${p.key}: ${p.message}`));
hstack(() => {
  btn("Paste example", () => setAll(pasted(EXAMPLE, { col: 0, row: 0 }), "pasted the example"));
  btn("Clear all", () => setAll(sheet.keys().map((k) => [k, ""] as const), "cleared"));
  btn("Home", () => browserContext.changePage("/"));
});
