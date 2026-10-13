// What the spreadsheet's panels share: the workbook and its commands (the
// seam), the view's own state (the selected cell's address, the formula
// bar, the status line, the problems, the sheets' names, the watched cells, the charts), the grid's handle and selection, and
// run(), the one way a panel changes anything: it runs a command, prints
// its outcome (what specs read), and shows the workbook again, in one batch.
import { COLS, addrOf, keyOf, parseRange } from "../address.ts";
import type { Addr } from "../address.ts";
import { Commands } from "../commands.ts";
import type { Outcome, Params } from "../commands.ts";
import type { Problem } from "../sheet.ts";
import { Workbook } from "../workbook.ts";
import { COLUMN_WIDTH } from "./grid.ts";
import type { ChartView, Watch } from "../workbook.ts";
import type { CellEditor } from "../editors.ts";

export class SheetView {
  readonly wb = new Workbook();
  // Files are saved in the page's storage.
  readonly cmds = new Commands(this.wb, storage);
  readonly address = state("A1");
  readonly input = state("");
  readonly status = state("");
  readonly comment = state("");
  readonly format = state("");
  // The selected cell's editor (editors.ts), or null.
  readonly editor = state<CellEditor | null>(null);
  readonly formulas = state<string>("Excel");
  readonly setup = state("");
  readonly problems = state<Problem[]>([]);
  readonly sheets = state<string[]>(["Sheet1"]);
  readonly active = state("Sheet1");
  readonly watches = state<Watch[]>([]);
  readonly charts = state<(ChartView & { n: number })[]>([]);
  grid = 0;
  // The rows made as tall as their wrapped text; the rows, columns (model)
  // and frozen rows the grid was last given.
  #fitted = new Set<number>();
  #shownHidden = { rows: new Set<number>(), cols: new Set<number>() };
  #frozen = 0;
  #merged: string[] = [];
  #sized = new Map<number, number>();

  // The selected cell's key (A1 when the address field names none).
  here(): string {
    return keyOf(addrOf(this.address.value) ?? { col: 0, row: 0 });
  }

  // The grid's selection as two sheet corners (the row numbers are not on
  // the sheet: a selection reaching them starts at column A), or null.
  selection(): [Addr, Addr] | null {
    const [ar, ac, r, c] = ui.datagrid_selection(this.grid);
    const corner = (row: number, col: number): Addr | null => {
      const m = Math.max(1, ui.datagrid_col_model(this.grid, col));
      return row >= 0 && m <= COLS ? { col: m - 1, row } : null;
    };
    const a = corner(ar, ac), b = corner(r, c);
    return a && b ? [a, b] : null;
  }

  // Where a sheet column is on screen now (columns can be dragged).
  viewCol(modelCol: number): number {
    for (let c = 0; c <= COLS; c++) if (ui.datagrid_col_model(this.grid, c) === modelCol) return c;
    return modelCol;
  }

  // A range selected, its first cell the address.
  select([a, b]: [Addr, Addr]): void {
    ui.datagrid_select_range(this.grid, a.row, this.viewCol(a.col + 1), b.row, this.viewCol(b.col + 1));
    this.address.set(keyOf(a));
  }

  // The selection as a command's range parameter: "F4:G7", or the cell.
  range(): string {
    const s = this.selection();
    return s ? `${keyOf(s[0])}:${keyOf(s[1])}` : this.here();
  }

  // The selected cell's input, status line and notes in their fields.
  follow(key = this.here()): void {
    const note = this.wb.notes.get(key);
    batch(() => {
      this.input.set(this.wb.sheet.input(key));
      this.status.set(this.wb.describe(key));
      this.comment.set(note.comment ?? "");
      this.format.set(note.format ?? "");
      this.editor.set(note.editor ?? null);
    });
  }

  // A command run, its outcome printed, the workbook shown again.
  run(id: string, params: Params = {}): Promise<Outcome> {
    return this.#outcome(() => this.cmds.execute(id, params));
  }

  // The same, from a command line (the command bar, and specs through it).
  runLine(line: string): Promise<Outcome> {
    return this.#outcome(() => this.cmds.run(line));
  }

  // A command that throws (a bug, as against a refusal) is said too: a
  // button's handler that returns a promise has no one to tell.
  async #outcome(command: () => Promise<Outcome>): Promise<Outcome> {
    try {
      return this.#shown(await command());
    } catch (e) {
      return this.#shown({ ok: false, message: `failed: ${String((e as Error)?.message ?? e)}`, changed: [] });
    }
  }

  #shown(o: Outcome): Outcome {
    print(`sheet: ${o.ok ? "" : "refused: "}${o.message}`);
    this.refresh();
    if (!o.ok) this.status.set(o.message);
    return o;
  }

  // The workbook shown again, in one batch (after a command, or a script).
  refresh(): void {
    batch(() => {
      this.problems.set(this.wb.sheet.problems());
      this.sheets.set(this.wb.sheetNames());
      this.active.set(this.wb.active);
      this.watches.set(this.wb.watches());
      this.charts.set(this.wb.charts().map((c, i) => ({ ...c, n: i + 1 })));
      this.formulas.set(this.wb.sheet.language.name);
      this.setup.set(this.wb.setupScript ? `Setup script: ${this.wb.setupScript}` : "");
      this.follow();
    });
    if (this.grid) {
      this.#showView();
      ui.datagrid_refresh(this.grid);
      this.#fitRows();
      this.#sizeCols();
    }
  }

  // Columns set to a width that width; columns no longer set the grid's.
  #sizeCols(): void {
    const set = new Map(this.wb.colWidths());
    for (const [c] of this.#sized) if (!set.has(c)) ui.datagrid_set_col_width(this.grid, this.viewCol(c + 1), COLUMN_WIDTH);
    for (const [c, w] of set) if (this.#sized.get(c) !== w) ui.datagrid_set_col_width(this.grid, this.viewCol(c + 1), w);
    this.#sized = set;
  }

  // The active sheet's hidden rows and columns and frozen rows, given to the
  // grid where they changed.
  #showView(): void {
    const { rows, cols } = this.wb.hidden(), was = this.#shownHidden;
    const want = { rows: new Set(rows), cols: new Set(cols) };
    for (const r of new Set([...was.rows, ...want.rows])) if (was.rows.has(r) !== want.rows.has(r)) ui.datagrid_hide_row(this.grid, r, want.rows.has(r) ? 1 : 0);
    for (const c of new Set([...was.cols, ...want.cols])) if (was.cols.has(c) !== want.cols.has(c)) ui.datagrid_hide_col(this.grid, this.viewCol(c + 1), want.cols.has(c) ? 1 : 0);
    this.#shownHidden = want;
    if (this.wb.frozenRows() !== this.#frozen) ui.datagrid_freeze_rows(this.grid, (this.#frozen = this.wb.frozenRows()));
    // Merges: those gone undone, those new made (at the columns on screen).
    const merges = this.wb.merges();
    for (const m of this.#merged) if (!merges.includes(m)) {
      const [a] = parseRange(m)!;
      ui.datagrid_unmerge(this.grid, a.row, this.viewCol(a.col + 1));
    }
    for (const m of merges) if (!this.#merged.includes(m)) {
      const [a, b] = parseRange(m)!;
      ui.datagrid_merge(this.grid, a.row, this.viewCol(a.col + 1), b.row - a.row + 1, b.col - a.col + 1);
    }
    this.#merged = merges;
  }

  // Rows set to a height that height; other rows with wrapped text as tall
  // as it; rows no longer either as tall as the grid's.
  #fitRows(): void {
    const set = new Map(this.wb.rowHeights()), wrapped = new Set(this.wb.wrapped().filter((r) => !set.has(r)));
    for (const r of this.#fitted) if (!set.has(r) && !wrapped.has(r)) ui.datagrid_set_row_height(this.grid, r, 0);
    for (const [r, h] of set) ui.datagrid_set_row_height(this.grid, r, h);
    for (const r of wrapped) ui.datagrid_fit_row(this.grid, r);
    this.#fitted = new Set([...set.keys(), ...wrapped]);
  }
}
