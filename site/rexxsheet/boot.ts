// The coupling, as the Tauri app's SpreadsheetApp does it at start: a
// SpreadsheetModel, a SpreadsheetRexxAdapter whose RexxJS interpreter
// resolves cell names through the model, and the app's function library
// (SUM_RANGE and friends) registered as the interpreter's external
// functions. No ui: the page (site/rexxsheet.ts) and the headless tests
// (lower/tests/mod/rexxsheet_*.ts) both start here.
import { RexxInterpreter } from "./rexxjs.js";
import SpreadsheetModel from "./spreadsheet-model.js";
import SpreadsheetRexxAdapter from "./spreadsheet-rexx-adapter.js";
import SpreadsheetLoader from "./spreadsheet-loader.js";
import { SPREADSHEET_FUNCTIONS, useAdapter } from "./spreadsheet-functions.js";

export interface RexxSheet {
  readonly model: any;
  readonly adapter: any;
}

export async function rexxSheet(rows = 100, cols = 26): Promise<RexxSheet> {
  const model = new SpreadsheetModel(rows, cols);
  const adapter = new SpreadsheetRexxAdapter(model);
  await adapter.initializeInterpreter(RexxInterpreter);
  useAdapter(adapter);
  Object.assign(adapter.interpreter.externalFunctions, SPREADSHEET_FUNCTIONS);
  return { model, adapter };
}

// A sheet file's data (the app's .json/.rexxsheet format) into the model:
// its setup script run, then its cells set, as the app's loader does.
export const load = (s: RexxSheet, data: unknown): Promise<void> => SpreadsheetLoader.importIntoModel(s.model, data, s.adapter);
