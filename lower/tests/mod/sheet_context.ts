// References to other sheets, below the workbook: the lexer and parser
// (Costs!B2, 'My Costs'!B2, Costs!B1:B3), what a formula reads in each
// language, edits that move only the references they are for, and a Sheet
// in a stubbed Context (the workbook's part: the other sheets' values).
import { span } from "./sheet/address.ts";
import { EXCEL } from "./sheet/excel.ts";
import { RexxLanguage } from "./sheet/rexx.ts";
import { byOffset, inserted } from "./sheet/shift.ts";
import { Sheet, Turns } from "./sheet/sheet.ts";
import type { Context } from "./sheet/sheet.ts";
import type { Language } from "./sheet/language.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const reads = (lang: { compile: typeof EXCEL.compile }, formula: string) => {
  const f = lang.compile(formula);
  return f.kind === "formula" ? f.reads : f.error.why;
};

eq("span: a range's keys on its sheet, and its width", [span("COSTS!B1", "C2"), span("A1", "A2"), span("A1", "AA1")],
  [{ keys: ["COSTS!B1", "COSTS!C1", "COSTS!B2", "COSTS!C2"], cols: 2 }, { keys: ["A1", "A2"], cols: 1 }, null]);
eq("Excel: a cell, a range and a quoted name on another sheet, any case", reads(EXCEL, "Costs!B2 + SUM(costs!B1:B2) + 'My Costs'!$A$1"),
  ["COSTS!B2", "COSTS!B1", "COSTS!B2", "MY COSTS!A1"]);
eq("a range on two sheets does not parse", reads(EXCEL, "SUM(Costs!B1:Other!B2)"), "parse error at 15: a range on two sheets");

const rexx = new RexxLanguage();
eq("RexxJS: Costs_B2 is a read, and a range in a string", reads(rexx, 'Costs_B2 + My_Sheet_C3 + SUM_RANGE("Costs!B1:B2") + A1'),
  ["COSTS!B1", "COSTS!B2", "A1", "MY_SHEET!C3"]);
eq("its range functions read the other sheet", await (async () => {
  const f = rexx.compile('Costs_B2 + SUM_RANGE("Costs!B1:B2")');
  return f.kind === "formula" ? f.run({ get: (k) => ({ "COSTS!B1": 1, "COSTS!B2": 2 } as Record<string, Value>)[k] ?? null }) : null;
})(), 5);
eq("a sheet that is not there is the error the workbook gives", await (async () => {
  const f = rexx.compile("Gone_B2 * 2");
  const v = f.kind === "formula" ? await f.run({ get: () => new CellError("#REF!", "no sheet GONE") }) : null;
  return v instanceof CellError ? `${v.code} ${v.why}` : v;
})(), "#REF! no sheet GONE");

eq("a copy moves every reference, keeping its sheet as typed", [EXCEL.rewrite("=costs!B2+A1", byOffset({ cols: 0, rows: 1 })), rexx.rewrite('=SUM_RANGE("Costs!B1:B2")', byOffset({ cols: 1, rows: 0 }))],
  ["=costs!B3+A2", '=SUM_RANGE("Costs!C1:C2")']);
const onCosts = inserted("row", 0, 1, (s) => s === "COSTS");
eq("rows inserted on a sheet move only the references to it", [EXCEL.rewrite("=Costs!B2+A1+Other!A1", onCosts), rexx.rewrite('=A1 + SUM_RANGE("Costs!B1:B2")', onCosts)],
  ["=Costs!B3+A1+Other!A1", '=A1 + SUM_RANGE("Costs!B2:B3")']);
eq("by default, only the unqualified ones", EXCEL.rewrite("=Costs!B2+A1", inserted("row", 0, 1)), "=Costs!B2+A2");

// A Sheet whose Context is a stub: it answers COSTS!B2 and logs what it was asked.
const asked: string[] = [];
let costs: Value = 10;
const context: Context = {
  name: "SHEET1", turns: new Turns(),
  value: (key) => {
    asked.push(key);
    return key === "COSTS!B2" ? costs : new CellError("#REF!", `no sheet ${key.split("!")[0]}`);
  },
};
const s = new Sheet(undefined, EXCEL, context);
const changed = await s.setMany([["A1", "=Costs!B2*2"], ["A2", "=A1+Sheet1!A1"], ["A3", "=Nope!A1"]]);
eq("another sheet's cells are the context's to answer", [show(s.value("A1")), show(s.value("A3")), asked.includes("COSTS!B2"), asked.includes("NOPE!A1")],
  ["20", "#REF!", true, true]);
eq("its own name is its own cells, and changed lists only its own", [show(s.value("A2")), changed], ["40", ["A1", "A2", "A3"]]);
costs = 7;
eq("touch: what reads a cell elsewhere is worked out again, and said", await s.touch(["COSTS!B2", "COSTS!C9"]), ["A1", "A2"]);
eq("to its new value", show(s.value("A2")), "28");
{
  // A language whose formulas log when they start and finish, a tick apart.
  const log: string[] = [];
  const slow: Language = {
    name: "RexxJS",
    compile: (formula) => ({ kind: "formula", reads: [], run: async () => {
      log.push(`start ${formula}`);
      await null;
      log.push(`end ${formula}`);
      return 1;
    } }),
    rewrite: (input) => input, functions: () => [],
  };
  const turns = new Turns();
  const one = new Sheet(undefined, slow, { ...context, turns }), two = new Sheet(undefined, slow, { ...context, turns });
  await Promise.all([one.set("A1", "=one"), two.set("A1", "=two")]);
  eq("sheets that share Turns take turns", log, ["start one", "end one", "start two", "end two"]);
}
// expect: ok span: a range's keys on its sheet, and its width
// expect: ok Excel: a cell, a range and a quoted name on another sheet, any case
// expect: ok a range on two sheets does not parse
// expect: ok RexxJS: Costs_B2 is a read, and a range in a string
// expect: ok its range functions read the other sheet
// expect: ok a sheet that is not there is the error the workbook gives
// expect: ok a copy moves every reference, keeping its sheet as typed
// expect: ok rows inserted on a sheet move only the references to it
// expect: ok by default, only the unqualified ones
// expect: ok another sheet's cells are the context's to answer
// expect: ok its own name is its own cells, and changed lists only its own
// expect: ok touch: what reads a cell elsewhere is worked out again, and said
// expect: ok to its new value
// expect: ok sheets that share Turns take turns
