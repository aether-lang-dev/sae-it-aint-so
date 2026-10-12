// What the spreadsheet's panels share: the workbook and its commands (the
// seam), the view's own state (the selected cell's address, the formula
// bar, the status line, the problems), the grid's handle and selection, and
// run(), the one way a panel changes anything: it runs a command, prints
// its outcome (what specs read), and shows the workbook again, in one batch.
import { COLS, addrOf, keyOf } from "../address.ts";
import type { Addr } from "../address.ts";
import { Commands } from "../commands.ts";
import type { Outcome, Params } from "../commands.ts";
import type { Problem } from "../sheet.ts";
import { Workbook } from "../workbook.ts";

export class SheetView {
  readonly wb = new Workbook();
  readonly cmds = new Commands(this.wb);
  readonly address = state("A1");
  readonly input = state("");
  readonly status = state("");
  readonly comment = state("");
  readonly format = state("");
  readonly formulas = state<string>("Excel");
  readonly setup = state("");
  readonly problems = state<Problem[]>([]);
  grid = 0;

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
    });
  }

  // A command run, its outcome printed, the workbook shown again.
  async run(id: string, params: Params = {}): Promise<Outcome> {
    return this.#shown(await this.cmds.execute(id, params));
  }

  // The same, from a command line (the command bar, and specs through it).
  async runLine(line: string): Promise<Outcome> {
    return this.#shown(await this.cmds.run(line));
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
      this.formulas.set(this.wb.sheet.language.name);
      this.setup.set(this.wb.setupScript ? `Setup script: ${this.wb.setupScript}` : "");
      this.follow();
    });
    if (this.grid) ui.datagrid_refresh(this.grid);
  }
}
