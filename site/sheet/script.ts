// RexxJS scripts that drive the sheet, as the Tauri spreadsheet's control
// bus and ARexx did: ADDRESS SHEET sends a command line (commands.ts) and
// sets RC (0, or 1 when refused) and RESULT (what it gave); SETCELL and
// GETCELL set and read a cell; cell names read the sheet, and the range
// functions work, as in formulas. Each script runs on an interpreter of its
// own: the formulas' interpreter is busy whenever a change it makes is
// being worked out.
import { addrOf, keyOf } from "./address.ts";
import { rangeFunctions } from "./rexx.ts";
import { RexxInterpreter, parse } from "./rexxjs.js";

export interface Outcome {
  readonly ok: boolean;
  readonly message: string;
  readonly output?: unknown;
}

// What a script reaches: the commands, and the cells' values.
export interface ScriptHost {
  run(line: string): Promise<Outcome>;
  set(cell: string, input: string): Promise<Outcome>;
  get(cell: string): unknown;
}

const lastLine = (e: unknown): string => String((e as Error)?.message ?? e).split("\n").pop()!;

export async function runScript(text: string, host: ScriptHost, say: (line: string) => void): Promise<Outcome> {
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
  Object.assign(it.externalFunctions, rangeFunctions((k) => host.get(k)), {
    SETCELL: async (cell: string, input: unknown) => {
      const o = await host.set(String(cell), String(input ?? ""));
      if (!o.ok) throw new Error(o.message);
      return o.output ?? "";
    },
    GETCELL: (cell: string) => host.get(String(cell).toUpperCase()),
  });
  try {
    await it.run(parse(text));
    return { ok: true, message: "ran" };
  } catch (e) {
    return { ok: false, message: lastLine(e) };
  }
}
