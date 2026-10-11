// Spreadsheet (docs/roadmap.md demo 18): a 10 x 20 sheet with formulas.
// site/sheet/ is the language and the model, with no ui: a tokenizer
// generator, a recursive-descent parser into a union AST, an evaluator whose
// errors are values, and a Sheet that keeps who-reads-whom and recomputes
// downstream in order, finding cycles. This page is the view: the grid is
// ui.datagrid (selection, the arrow keys, column resize and move, in-cell
// editing that opens on the formula, all the toolkit's), styled per cell
// (numbers to the right, errors in red); the formula bar, status line,
// problem list and summary are state, bind (two-way for the fields),
// computed and each; a paste is one batch, and one refresh of the grid.
// Over a selection, Delete clears it, Ctrl+C and Ctrl+V copy and paste it
// within the sheet (formulas move, $ fixes), and Ctrl+D and Ctrl+R fill it
// down and right, and Ctrl+Z and Ctrl+Y undo and redo. The major setting is the formula language: "Excel
// formulas" (=SUM(A1:A3)) or "RexxJS formulas" (=SUM_RANGE("A1:A3"),
// =A2 |> UPPER), as the Tauri spreadsheet (RexxJS/example-app-spreadsheet)
// has them, whose sheet files open here with their setup scripts.
import { COLS, ROWS, addrOf, colName, keyOf, range } from "./sheet/address.ts";
import type { Addr } from "./sheet/address.ts";
import { Sheet } from "./sheet/sheet.ts";
import { copied, filled, pasted } from "./sheet/copy.ts";
import type { Problem } from "./sheet/sheet.ts";
import { describe, show } from "./sheet/format.ts";
import { EXCEL } from "./sheet/excel.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { readSheetFile } from "./sheet/file.ts";
import type { SheetFile } from "./sheet/file.ts";
import { FORMATTED, SAMPLE_BUDGET, TEST_SHEET } from "./sheet/samples.ts";
import { CellNotes } from "./sheet/notes.ts";
import { formatted, toStyle } from "./sheet/formats.ts";
import { CellError } from "./sheet/values.ts";

const { text, btn, textfield, hstack, text_wrapped, on_submit, focus, cells, headers, edit_text, cell_style,
        on_cell_select, on_cell_edit, on_col_resize, column_width } = ui;

const EXAMPLE = [
  "Item\tQty\tPrice\tTotal",
  "Apples\t6\t0.45\t=B2*C2",
  "Bread\t1\t2.2\t=B3*C3",
  "Milk\t2\t1.15\t=B4*C4",
  "Total\t=SUM(B2:B4)\t\t=SUM(D2:D4)",
  "Average\t\t=AVERAGE(C2:C4)\t=ROUND(D5/B5, 2)",
].join("\n");

const sheet = new Sheet();
const rexx = new RexxLanguage();
const languages = { Excel: EXCEL, RexxJS: rexx } as const;
// What cells carry besides their inputs (comment, format, style, a
// conditional style), and each conditional style as last worked out.
const notes = new CellNotes();
let conditional = new Map<string, string>();

// The grid's column 0 is the frozen row numbers; column c + 1 is sheet
// column c. The cell, edit_text and cell_style functions and on_cell_edit
// get model columns; on_cell_select a column on screen (columns move).
const addrAt = (row: number, modelCol: number): Addr | null =>
  modelCol >= 1 && modelCol <= COLS && row >= 0 && row < ROWS ? { col: modelCol - 1, row } : null;
const keyAt = (row: number, modelCol: number): string | null => {
  const a = addrAt(row, modelCol);
  return a ? keyOf(a) : null;
};

const address = state("A1");
const input = state("");
const status = state("");
const problems = state<Problem[]>([]);
const formulas = state<"Excel" | "RexxJS">("Excel");
const comment = state("");
const format = state("");
const setupScript = state("");
const functionList = computed(() => {
  const own = formulas.value === "RexxJS" ? ", and RexxJS's own (UPPER, SUBSTR, WORD, LENGTH, ...)" : "";
  return `${formulas.value} functions: ${languages[formulas.value].functions().join(", ")}${own}`;
}, formulas);
const summary = computed(() => {
  const n = problems.value.length;
  return n === 0 ? "No problems" : `${n} problem${n === 1 ? "" : "s"}`;
}, problems);

let grid = 0;

const described = (key: string) => describe(key, sheet.input(key), sheet.value(key), notes.get(key).comment);

// Every conditional style worked out again, in the sheet's language, after
// a change (it may read any cell).
const restyle = async () => {
  const next = new Map<string, string>();
  for (const [key, expr] of notes.conditional()) next.set(key, toStyle(await sheet.evaluate(expr)));
  conditional = next;
};

// What a cell shows: its value in its number format.
const textOf = (key: string) => {
  const v = sheet.value(key);
  return formatted(v, notes.get(key).format ?? "") ?? show(v);
};

// Its style, each layer over the last: numbers to the right, its own style,
// its format's style parts, its conditional style, and an error in red.
const styleOf = (key: string) => {
  const v = sheet.value(key), n = notes.get(key);
  return [typeof v === "number" ? "text-align: end" : "", toStyle(n.style), toStyle(n.format), conditional.get(key) ?? "",
    v instanceof CellError ? "color: #c0392b" : ""].filter((p) => p).join("; ");
};

const settled = (key: string) => {
  problems.set(sheet.problems());
  status.set(described(key));
  ui.datagrid_refresh(grid);
};

// Each change is worked out (a promise: RexxJS evaluates asynchronously),
// then shown in one batch.
const commit = async (key: string, text: string) => {
  await sheet.set(key, text.trim());
  await restyle();
  batch(() => {
    address.set(key);
    input.set(sheet.input(key));
    settled(key);
  });
  print(`sheet: ${key} = ${show(sheet.value(key))}`);
};

const enter = () => {
  const at = addrOf(address.value);
  if (!at) {
    status.set(`${address.value}: not a cell on this sheet`);
    return;
  }
  commit(keyOf(at), input.value);
};

const here = () => keyOf(addrOf(address.value) ?? { col: 0, row: 0 });

// Many cells at once (a paste, a clear): one recompute, one batch.
const setAll = async (entries: readonly (readonly [string, string])[], what: string) => {
  const changed = await sheet.setMany(entries);
  await restyle();
  batch(() => settled(here()));
  print(`sheet: ${what}: ${entries.length} cells set, ${changed.length} changed`);
};

// Undo and redo: the last change taken back, or done again.
const history = async (way: "undo" | "redo") => {
  const changed = await (way === "undo" ? sheet.undo() : sheet.redo());
  await restyle();
  batch(() => {
    input.set(sheet.input(here()));
    settled(here());
  });
  print(`sheet: ${way}: ${changed.length} changed`);
};

// The major setting: every formula read again in the other language.
const useFormulas = async (name: "Excel" | "RexxJS") => {
  await sheet.setLanguage(languages[name]);
  await restyle();
  batch(() => {
    formulas.set(name);
    settled(here());
  });
  print(`sheet: ${name} formulas`);
};

// A sheet file (the Tauri app's format): the sheet emptied, its language,
// its setup script run, its cells set, its notes kept.
const open = async (file: SheetFile) => {
  await sheet.setMany(sheet.keys().map((k) => [k, ""] as const));
  const failed = file.language === "RexxJS" ? await rexx.setup(file.setupScript) : null;
  await sheet.setLanguage(languages[file.language]);
  await sheet.setMany(file.entries);
  sheet.forget();
  notes.clear();
  for (const [key, note] of file.notes) notes.set(key, note);
  await restyle();
  batch(() => {
    formulas.set(file.language);
    setupScript.set(file.setupScript ? `Setup script: ${file.setupScript}` : "");
    settled(here());
    if (failed) status.set(`The setup script failed: ${failed.split("\n").pop()}`);
  });
  print(`sheet: opened ${file.name}: ${file.entries.length} cells, ${file.language} formulas`);
};

// Where a sheet column is on screen now (columns can be dragged).
const viewCol = (modelCol: number): number => {
  for (let v = 0; v <= COLS; v++) if (ui.datagrid_col_model(grid, v) === modelCol) return v;
  return modelCol;
};

// The grid's selection as two sheet corners (the row numbers are not on
// the sheet: a selection reaching them starts at column A), or null.
const selection = (): [Addr, Addr] | null => {
  const [ar, ac, r, c] = ui.datagrid_selection(grid);
  const corner = (row: number, col: number) => addrAt(row, Math.max(1, ui.datagrid_col_model(grid, col)));
  const a = corner(ar, ac), b = corner(r, c);
  return a && b ? [a, b] : null;
};
const topLeft = ([a, b]: [Addr, Addr]): Addr => ({ col: Math.min(a.col, b.col), row: Math.min(a.row, b.row) });
const inputOf = (key: string) => sheet.input(key);

// The sheet's own clipboard: what was copied, and from where, so a paste
// moves its formulas. Pages have no system clipboard yet.
let clip: { tsv: string; from: Addr } | null = null;

// Keys over the grid's selection; while an editor is open, or a field has
// the focus, keys are theirs.
const SHIFT = 1, CTRL = 2, SUPER = 8;
ui.on_key((key: string, mods: number) => {
  if (!ui.datagrid_has_focus(grid) || ui.datagrid_editor(grid) !== 0) return;
  const sel = selection();
  if (!sel) return;
  const [a, b] = sel;
  const named = `${keyOf(a)}:${keyOf(b)}`;
  if (key === "Delete" || key === "BackSpace") {
    setAll([...range(a, b)].map((k) => [k, ""] as const), `cleared ${named}`);
    return;
  }
  if ((mods & (CTRL | SUPER)) === 0) return;
  switch (key.toLowerCase()) {
    case "z":
      history((mods & SHIFT) !== 0 ? "redo" : "undo");
      return;
    case "y":
      history("redo");
      return;
    case "c":
      clip = { tsv: copied(inputOf, a, b), from: topLeft(sel) };
      print(`sheet: copied ${named}`);
      return;
    case "v":
      if (clip) setAll(pasted(clip.tsv, topLeft(sel), { from: clip.from, language: sheet.language }), `pasted at ${keyOf(topLeft(sel))}`);
      return;
    case "d":
      setAll(filled(inputOf, a, b, "down", sheet.language), `filled ${named} down`);
      return;
    case "r":
      setAll(filled(inputOf, a, b, "right", sheet.language), `filled ${named} right`);
      return;
  }
});

text("Spreadsheet");
hstack(() => {
  bind(text(""), computed(() => `${formulas.value} formulas`, formulas));
  btn("Excel formulas", () => useFormulas("Excel"));
  btn("RexxJS formulas", () => useFormulas("RexxJS"));
});
let formula = 0;
hstack(() => {
  const cell = bind(textfield("cell", () => {}), address);
  formula = bind(textfield("formula", () => {}), input);
  on_submit(cell, () => focus(formula));
  on_submit(formula, enter);
});
bind(text(""), status);
// The selected cell's comment and number format (or style: "bold;
// color:red", "$#,##0.00", "percent:0.0%"); Return sets them.
const note = async (parts: { comment?: string; format?: string }) => {
  notes.set(here(), parts);
  await restyle();
  batch(() => settled(here()));
  print(`sheet: ${here()} ${Object.entries(parts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
};
hstack(() => {
  on_submit(bind(textfield("comment", () => {}), comment), () => note({ comment: comment.value }));
  on_submit(bind(textfield("format", () => {}), format), () => note({ format: format.value }));
});

grid = ui.datagrid(ROWS, COLS + 1, ROWS, COLS, 1, () => {
  column_width(80);
  cells((r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? textOf(key) : String(r + 1);
  });
  headers((c: number) => (c === 0 ? "" : colName(c - 1)));
  // An editor opens on what was typed, not what it came to.
  edit_text((r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? sheet.input(key) : "";
  });
  cell_style((r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? styleOf(key) : "color: #6a6f7a; text-align: end";
  });
  on_cell_select((r: number, c: number) => {
    const key = keyAt(r, ui.datagrid_col_model(grid, c));
    if (key && key !== address.value) address.set(key);
  });
  on_cell_edit((r: number, c: number, t: string) => {
    const key = keyAt(r, c);
    if (key) commit(key, t);
  });
  on_col_resize((c: number, w: number) => {
    const m = ui.datagrid_col_model(grid, c);
    if (m >= 1) print(`sheet: column ${colName(m - 1)} is ${w} wide`);
  });
});

ui.datagrid_set_col_width(grid, 0, 34);     // the row numbers

// The address field drives the formula field and the grid's selection: name
// a cell, see what it holds.
address.subscribe((a: string) => {
  const at = addrOf(a);
  if (!at) return;
  const key = keyOf(at);
  const [, , r, c] = ui.datagrid_selection(grid);
  if (r !== at.row || ui.datagrid_col_model(grid, c) !== at.col + 1) ui.datagrid_select(grid, at.row, viewCol(at.col + 1));
  batch(() => {
    input.set(sheet.input(key));
    status.set(described(key));
    comment.set(notes.get(key).comment ?? "");
    format.set(notes.get(key).format ?? "");
  });
});

bind(text_wrapped("", 720), functionList);
bind(text_wrapped("", 720), setupScript);
bind(text(""), summary);
each(problems, "key", (p: Problem) => text(`${p.key}: ${p.message}`));
hstack(() => {
  btn("Paste example", async () => {
    if (formulas.value !== "Excel") await useFormulas("Excel");
    await setAll(pasted(EXAMPLE, { col: 0, row: 0 }), "pasted the example");
  });
  btn("Budget (RexxJS)", () => open(readSheetFile(SAMPLE_BUDGET)));
  btn("Test sheet (RexxJS)", () => open(readSheetFile(TEST_SHEET)));
  btn("Formatted (RexxJS)", () => open(readSheetFile(FORMATTED)));
  btn("Undo", () => history("undo"));
  btn("Redo", () => history("redo"));
  btn("Clear all", () => {
    notes.clear();
    return setAll(sheet.keys().map((k) => [k, ""] as const), "cleared");
  });
  btn("Home", () => browserContext.changePage("/"));
});
