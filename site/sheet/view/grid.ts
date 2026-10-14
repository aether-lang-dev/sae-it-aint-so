// The grid panel: ui.datagrid over the workbook. Column 0 is the frozen row
// numbers; column c + 1 is sheet column c. The cell, edit_text and
// cell_style functions and on_cell_edit get model columns; on_cell_select a
// column on screen (columns move). Keys over the selection run commands:
// Delete clears it, Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste (over
// the selection: a cell copied fills each of its cells; with the system
// clipboard, to and from other apps too), Ctrl+D and Ctrl+R
// fill, Ctrl+Z and Ctrl+Y (Ctrl+Shift+Z) undo and redo, Ctrl+B, Ctrl+I and
// Ctrl+U the look (Ctrl+arrows, to the edge of the data, are the grid's
// own); while an editor is open, or a field has the focus, keys
// are theirs. A cell's comment shows when the pointer rests on it.
//
// While a formula is typed in a cell, the references it names are outlined
// in their colours, and a click on a cell with the caret after '=', an
// operator, '(', ',' or ':' puts that cell's reference in (point mode): the
// click commits the editor first, so that commit is held back, and the
// editor opens again on the cell with the reference added.
import { COLS, ROWS, addrOf, colName, keyOf } from "../address.ts";
import type { SheetView } from "./view.ts";
import { toggleFont } from "./lookbar.ts";
import { pointable } from "../typing.ts";

const SHIFT = 1, CTRL = 2, SUPER = 8;
// A column's width until one is set (columns.width).
export const COLUMN_WIDTH = 80;
// The window of cells on screen at once: the grid scrolls over the rest.
const SHOWN_ROWS = 25, SHOWN_COLS = 10;

export function sheetGrid(v: SheetView): void {
  const { cells, headers, edit_text, cell_style, on_cell_select, on_cell_edit, on_col_resize, column_width } = ui;
  const keyAt = (row: number, modelCol: number): string | null =>
    modelCol >= 1 && modelCol <= COLS && row >= 0 && row < ROWS ? keyOf({ col: modelCol - 1, row }) : null;
  // Whether a click puts a reference in the open editor (point mode), and
  // a formula held back for it: its cell (row, model column) and text.
  let pointing = false;
  let held: { r: number; c: number; text: string } | null = null;
  const typed = (text: string | null) => {
    v.wb.typing(text);
    ui.datagrid_refresh(v.grid);
  };

  v.grid = ui.datagrid(ROWS, COLS + 1, SHOWN_ROWS, SHOWN_COLS, 1, () => {
    column_width(COLUMN_WIDTH);
    cells((r: number, c: number) => {
      const key = keyAt(r, c);
      return key ? v.wb.textOf(key) : String(r + 1);
    });
    headers((c: number) => (c === 0 ? "" : colName(c - 1)));
    // An editor opens on what was typed, not what it came to.
    edit_text((r: number, c: number) => {
      if (held && held.r === r && held.c === c) return held.text;
      const key = keyAt(r, c);
      return key ? v.wb.sheet.input(key) : "";
    });
    cell_style((r: number, c: number) => {
      const key = keyAt(r, c);
      return key ? v.wb.styleOf(key) : "color: #6a6f7a; text-align: end";
    });
    on_cell_select((r: number, c: number) => {
      const key = keyAt(r, ui.datagrid_col_model(v.grid, c));
      if (key && held) {
        const { r: hr, c: hc } = held;
        held = { ...held, text: held.text + key };
        ui.datagrid_edit(v.grid, hr, v.viewCol(hc));
        held = null;
        return;
      }
      if (key && key !== v.address.value) v.address.set(key);
    });
    on_cell_edit((r: number, c: number, t: string) => {
      const key = keyAt(r, c);
      if (pointing && key) {
        // A click to point: wait for the cell it selects (or, if none does,
        // store the formula as it was).
        held = { r, c, text: t };
        setTimeout(() => {
          if (held && held.r === r && held.c === c) {
            held = null;
            v.wb.typing(null);
            v.run("cell.set", { cell: key, input: t.trim() });
          }
        }, 0);
        return;
      }
      pointing = false;
      v.wb.typing(null);
      if (key) {
        v.address.set(key);
        v.run("cell.set", { cell: key, input: t.trim() });
      }
    });
    on_col_resize((c: number, w: number) => {
      const m = ui.datagrid_col_model(v.grid, c);
      if (m < 1) return;
      print(`sheet: column ${colName(m - 1)} is ${w} wide`);
      // Kept in the model, so it is saved and undone with the rest.
      if (v.wb.colWidths().find(([col]) => col === m - 1)?.[1] !== w) v.run("columns.width", { range: `${colName(m - 1)}1`, width: String(w) });
    });
  });
  ui.datagrid_set_col_width(v.grid, 0, 34);     // the row numbers
  ui.datagrid_on_edit_change(v.grid, (text: string, caret: number) => {
    pointing = pointable(text, caret);
    typed(text);
  });
  ui.datagrid_cell_tooltip(v.grid, (r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? v.wb.tooltipOf(key) : "";
  });

  // The address field drives the grid's selection: name a cell, go to it.
  v.address.subscribe((a: string) => {
    const at = addrOf(a);
    if (!at) return;
    const [, , r, c] = ui.datagrid_selection(v.grid);
    if (r !== at.row || ui.datagrid_col_model(v.grid, c) !== at.col + 1) ui.datagrid_select(v.grid, at.row, v.viewCol(at.col + 1));
    v.follow(keyOf(at));
  });

  ui.on_key((key: string, mods: number) => {
    // Escape closes the editor without a commit: the outlines go with it.
    if (key === "Escape") {
      pointing = false;
      setTimeout(() => typed(null), 0);
    }
    if (!ui.datagrid_has_focus(v.grid) || ui.datagrid_editor(v.grid) !== 0) return;
    if (!v.selection()) return;
    const range = v.range();
    if (key === "Delete" || key === "BackSpace") {
      v.run("range.clear", { range });
      return;
    }
    if ((mods & (CTRL | SUPER)) === 0) return;
    switch (key.toLowerCase()) {
      case "c": copyOut(v, "edit.copy", range); return;
      case "x": copyOut(v, "edit.cut", range); return;
      case "v": pasteIn(v, range); return;
      case "d": v.run("edit.fillDown", { range }); return;
      case "r": v.run("edit.fillRight", { range }); return;
      case "z": v.run((mods & SHIFT) !== 0 ? "edit.redo" : "edit.undo"); return;
      case "y": v.run("edit.redo"); return;
      case "b": toggleFont(v, "bold"); return;
      case "i": toggleFont(v, "italic"); return;
      case "u": toggleFont(v, "underline"); return;
    }
  });
}

// The system clipboard, where the page has it (clipboard: writes while the
// person clicks or types, reads only their paste). A copy or cut goes there
// too, as what the cells show, tab-separated, as other apps take it.
function copyOut(v: SheetView, id: string, range: string): void {
  v.run(id, { range }).then((o) => {
    if (o.ok && typeof clipboard !== "undefined" && v.wb.clip) return clipboard.write_text(shownTsv(v));
  }).catch((e) => v.status.set(String((e as Error)?.message ?? e)));
}

// A paste: this sheet's own copy as before (its formulas move, a cut
// moves), or another app's text, taken as written.
function pasteIn(v: SheetView, range: string): void {
  if (typeof clipboard === "undefined") {
    v.run("edit.paste", { at: range });
    return;
  }
  clipboard.read_text().then((text) => {
    const own = !!v.wb.clip && text.replace(/\r/g, "").replace(/\n+$/, "") === shownTsv(v);
    return own || text === "" ? v.run("edit.paste", { at: range }) : v.run("edit.pasteText", { at: range, text });
  }, () => v.run("edit.paste", { at: range }));
}

// What the copied cells show, a row a line, tab-separated.
const shownTsv = (v: SheetView): string => v.wb.clip!.shown.map((row) => row.join("\t")).join("\n");
