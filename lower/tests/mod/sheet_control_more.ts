// The rest of the Tauri app's control functions (site/sheet/control.ts),
// as sheet_control has the first: each against a stubbed exec, then through
// a Workbook and its commands.
import { CONTROL, controlFunctions } from "./sheet/control.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";
import { failed, told as toldBy } from "./lib/controlstub.ts";

const told = (name: string, args: unknown[], answers: Record<string, unknown> = {}) => toldBy(CONTROL, name, args, answers);

// The file, formulas without a cell, the setup script.
eq("EXPORT, IMPORT, EVALUATE, RECALCULATE and the setup script's three tell their commands", [
  await told("EXPORT", [], { "file.export": "{}" }), await told("IMPORT", ["{}"]), await told("EVALUATE", ["A1*2"], { "formulas.calculate": 4 }),
  await told("RECALCULATE", [], { "formulas.recalculate": 3 }), await told("GETSETUPSCRIPT", [], { "setup.get": "LET R = 1" }),
  await told("SETSETUPSCRIPT", ["LET R = 1"]), await told("EXECUTESETUPSCRIPT", []),
], [
  ["{}", [["file.export", {}]]], ["OK", [["file.import", { text: "{}" }]]], [4, [["formulas.calculate", { formula: "A1*2" }]]],
  [3, [["formulas.recalculate", {}]]], ["LET R = 1", [["setup.get", {}]]], ["OK", [["setup.set", { text: "LET R = 1" }]]], ["OK", [["setup.run", {}]]],
]);

const wb = new Workbook();
const cmds = new Commands(wb);
const exec = (id: string, params: Record<string, string>) => cmds.execute(id, params);
const fns = controlFunctions(exec, {});
for (const [k, v] of [["A1", "2"], ["A2", "3"], ["B1", "=A1*10"]]) await cmds.run(`cell.set cell=${k} input=${v}`);
eq("EVALUATE: a formula worked out against the sheet, no cell set; an error says why", [await fns.EVALUATE("SUM(A1:A2)"), await fns.EVALUATE("=A1&\"x\""), await failed(() => fns.EVALUATE("1/0")), wb.sheet.keys().sort()],
  [5, "2x", "=1/0 → #DIV/0! (divide by zero)", ["A1", "A2", "B1"]]);
eq("RECALCULATE: how many formulas it worked out", await fns.RECALCULATE(), 1);

await cmds.run("formulas.use language=RexxJS");
await cmds.run("cell.set cell=C1 input=\"=RATE * A1\"");
await fns.SETSETUPSCRIPT("LET RATE = 7");
eq("SETSETUPSCRIPT keeps it; EXECUTESETUPSCRIPT runs it and works everything out again", [show(wb.sheet.value("C1")), await fns.GETSETUPSCRIPT(), await fns.EXECUTESETUPSCRIPT(), show(wb.sheet.value("C1"))],
  ["#ERROR!", "LET RATE = 7", "OK", "14"]);
await fns.SETSETUPSCRIPT("LET RATE = 1/0");
eq("a setup script that fails, says why", await failed(() => fns.EXECUTESETUPSCRIPT()), "the setup script failed: Division by zero");
await fns.SETSETUPSCRIPT("LET RATE = 7");

const exported = await fns.EXPORT() as string;
const other = new Workbook();
const into = controlFunctions((id, params) => new Commands(other).execute(id, params), {});
eq("EXPORT gives the file's JSON; IMPORT opens it, setup script and all", [await into.IMPORT(exported), ["A1", "B1", "C1"].map((k) => show(other.sheet.value(k))), other.setupScript],
  ["OK", ["2", "20", "14"], "LET RATE = 7"]);
eq("IMPORT of what is not a sheet file", await failed(() => into.IMPORT("{nope")), "not a sheet file: " + (() => { try { JSON.parse("{nope"); } catch (e) { return (e as Error).message; } })());

eq("BATCH_SET_CELLS: each set that can be, and a summary", [JSON.parse(await fns.BATCH_SET_CELLS('[{"address":"D1","value":"5"},{"address":"Z99","value":"1"},{"address":"D2","value":"=D1+1"}]') as string), show(wb.sheet.value("D2"))],
  [{ total: 3, success: 2, errors: 1, errorDetails: [{ address: "Z99", error: "Z99 is not a cell on the sheet" }] }, "6"]);
const said: string[] = [];
await cmds.script(`LET r = BATCH_EXECUTE('[{"command":"setcell","args":["E1","9"]},{"command":"INSERTROW","args":[1]},{"command":"NOPE","args":[]},{"command":"INSERTROW","args":[0]}]'); SAY r`, (l) => said.push(l));
eq("BATCH_EXECUTE: each by any name a script has, SETCELL too; what each gave or why not", [JSON.parse(said[0]), show(wb.sheet.value("E2"))], [[
  { index: 0, command: "SETCELL", success: true, result: "9" }, { index: 1, command: "INSERTROW", success: true, result: "OK" },
  { index: 2, command: "NOPE", success: false, error: "Unknown command: NOPE" }, { index: 3, command: "INSERTROW", success: false, error: "INSERTROW needs a row number (e.g. 2)" },
], "9"]);
// expect: ok EXPORT, IMPORT, EVALUATE, RECALCULATE and the setup script's three tell their commands
// expect: ok EVALUATE: a formula worked out against the sheet, no cell set; an error says why
// expect: ok RECALCULATE: how many formulas it worked out
// expect: ok SETSETUPSCRIPT keeps it; EXECUTESETUPSCRIPT runs it and works everything out again
// expect: ok a setup script that fails, says why
// expect: ok EXPORT gives the file's JSON; IMPORT opens it, setup script and all
// expect: ok IMPORT of what is not a sheet file
// expect: ok BATCH_SET_CELLS: each set that can be, and a summary
// expect: ok BATCH_EXECUTE: each by any name a script has, SETCELL too; what each gave or why not
