// How the grid shows the app's model (RexxJS/example-app-spreadsheet's
// SpreadsheetModel), a cell at a time. No ui: site/rexxsheet.ts calls these
// from the datagrid's functions, and lower/tests/mod/rexxsheet_view.ts tests
// them headless.
import SpreadsheetModel from "./spreadsheet-model.js";

export const ROWS = 100;
export const COLS = 26;

// What the model keeps for a cell (getCell gives an empty one for a cell
// never set).
export interface Cell {
  readonly value: unknown;
  readonly expression: string | null;
  readonly error?: string | null;
  readonly comment?: string | null;
}

const NUMERIC = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;

// The cell name at a grid row and model column (column 0 is the row
// numbers), or null.
export function refAt(row: number, modelCol: number): string | null {
  if (row < 0 || row >= ROWS || modelCol < 1 || modelCol > COLS) return null;
  return SpreadsheetModel.formatCellRef(modelCol, row + 1);
}

// A cell name as typed ("b12", " Z100 ") as the model writes it, or null
// when it is not one on the sheet.
export function cellRef(typed: string): string | null {
  const m = /^\s*([A-Za-z]+)([1-9]\d*)\s*$/.exec(typed);
  return m ? refAt(Number(m[2]) - 1, SpreadsheetModel.colLetterToNumber(m[1])) : null;
}

export function shown(c: Cell): string {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(Number(v.toPrecision(10)));
  return String(v);
}

// What an editor opens on: the formula, not what it came to.
export const editText = (c: Cell): string => (c.expression ? `=${c.expression}` : shown(c));

export function styleOf(c: Cell): string {
  if (c.error) return "color: #c0392b";
  return typeof c.value === "number" || (typeof c.value === "string" && NUMERIC.test(c.value)) ? "text-align: end" : "";
}

// The status line: what was typed, what it came to, why it is an error (the
// last line of RexxJS's message), and the comment the file gave it.
export function describe(ref: string, c: Cell): string {
  const typed = editText(c);
  if (typed === "") return `${ref}: (empty)`;
  const why = c.error ? ` ${String(c.error).split("\n").pop()}` : "";
  const note = c.comment ? ` (${c.comment})` : "";
  return `${ref}: ${typed} → ${shown(c)}${why}${note}`;
}
