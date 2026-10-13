// RexxJS scripts that drive the sheet, as the Tauri spreadsheet's control
// bus and ARexx did: ADDRESS SHEET sends a command line (commands.ts) and
// sets RC (0, or 1 when refused) and RESULT (what it gave); SETCELL and
// GETCELL set and read a cell; cell names read the sheet, and the range
// functions work, as in formulas. The Tauri app's control functions are
// there by its names (control.ts), and ADDRESS SPREADSHEET runs each string
// it is sent as REXX, as the app's control bus does, so the app's scripts
// run as they are. Each script runs on an interpreter of its
// own: the formulas' interpreter is busy whenever a change it makes is
// being worked out.
import { addrOf, keyOf } from "./address.ts";
import { controlFunctions } from "./control.ts";
import { install, rangeFunctions } from "./rexx.ts";
import { RexxInterpreter, parse } from "./rexxjs.js";

export interface Outcome {
  readonly ok: boolean;
  readonly message: string;
  readonly output?: unknown;
}

// What a script reaches: the commands, and the cells' values.
export interface ScriptHost {
  run(line: string): Promise<Outcome>;
  execute(id: string, params: Record<string, string>): Promise<Outcome>;
  set(cell: string, input: string): Promise<Outcome>;
  get(cell: string): unknown;
}

const lastLine = (e: unknown): string => String((e as Error)?.message ?? e).split("\n").pop()!;

// Rexx separates clauses with ';' as well as with line ends (RexxJS reads
// only line ends): a ';' outside quotes is a line end, so a script fits on
// one line.
export function clauses(text: string): string {
  let out = "", quote = "";
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ";") {
      out += "\n";
      continue;
    }
    out += c;
  }
  return out;
}

export async function runScript(text: string, host: ScriptHost, say: (line: string) => void): Promise<Outcome> {
  const sheetFunctions = {
    ...rangeFunctions((k) => host.get(k)),
    SETCELL: async (cell: string, input: unknown) => {
      const o = await host.set(String(cell), String(input ?? ""));
      if (!o.ok) throw new Error(o.message);
      return String(input ?? "");   // the app's: what was set
    },
    GETCELL: (cell: string) => host.get(String(cell).toUpperCase()),
  };
  const functions = { ...sheetFunctions, ...controlFunctions((id, params) => host.execute(id, params), Object.keys(sheetFunctions)) };
  const interpreter = () => {
    const it = new RexxInterpreter(null, { output: (line: unknown) => say(String(line)) });
    it.variableResolver = (name: string) => (addrOf(name) ? host.get(keyOf(addrOf(name)!)) : undefined);
    it.addressTargets.set("sheet", {
      handler: async (line: string) => {
        const o = await host.run(String(line).trim());
        return { success: o.ok, errorCode: 1, output: o.output ?? o.message };
      },
      methods: {},
      metadata: { name: "sheet" },
    });
    // The app's control bus: each string is REXX (SETCELL("A1", "100")),
    // worked out on an interpreter of its own; RESULT is what it came to.
    it.addressTargets.set("spreadsheet", {
      handler: async (code: string) => {
        try {
          const one = interpreter();
          await one.run(parse(`LET RESULT = ${String(code).trim()}`));
          return { success: true, errorCode: 0, output: one.getVariable("RESULT") };
        } catch (e) {
          return { success: false, errorCode: 1, output: lastLine(e) };
        }
      },
      methods: {},
      metadata: { name: "spreadsheet" },
    });
    install(it, functions);
    return it;
  };
  try {
    await interpreter().run(parse(clauses(text)));
    return { ok: true, message: "ran" };
  } catch (e) {
    return { ok: false, message: lastLine(e) };
  }
}
