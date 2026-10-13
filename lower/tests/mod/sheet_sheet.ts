// site/sheet/sheet.ts against a mock listener: edits ripple downstream in
// dependency order, a paste recomputes each cell once, cycles are found and
// mended, and old dependencies are forgotten.
import { Sheet, compile } from "./sheet/sheet.ts";
import { refsOf } from "./sheet/excel.ts";
import type { Language } from "./sheet/language.ts";
import type { SheetListener } from "./sheet/sheet.ts";
import { parse } from "./sheet/parser.ts";
import { show } from "./sheet/format.ts";
import { eq, mock, throws } from "./lib/check.ts";

const shown = (s: Sheet, ...keys: string[]) => keys.map((k) => show(s.value(k)));

eq("constants: numbers, text, nothing", [compile("42"), compile(" -1.5e1 "), compile("pears"), compile("")].map((c) => c.kind === "constant" ? c.value : c.kind), [42, -15, "pears", null]);
eq("a formula", compile("=1").kind, "formula");
const broken = compile("=SUM(A1");
eq("a parse error becomes #ERROR!, with where", broken.kind === "broken" ? `${broken.error.code} ${broken.error.why}` : broken.kind, "#ERROR! parse error at 8: expected ')' but found the end");
eq("refsOf spells out ranges and skips the off-sheet", [...refsOf(parse("A1+SUM(B1:C2)*K9+IF(A1, D4)"))], ["A1", "B1", "C1", "B2", "C2", "A1", "D4"]);

{
  const l = mock<SheetListener>();
  const s = new Sheet(l.it);
  eq("set returns what changed", await s.set("A1", "2"), ["A1"]);
  await s.set("B1", "=A1*10");
  await s.set("C1", "=B1+A1");
  eq("formulas read their cells", shown(s, "A1", "B1", "C1"), ["2", "20", "22"]);
  l.calls.length = 0;
  eq("an edit ripples through everything downstream", await s.set("A1", "5"), ["A1", "B1", "C1"]);
  eq("and the listener hears each, upstream first", l.calls, [["changed", "A1", 5], ["changed", "B1", 50], ["changed", "C1", 55]]);
  l.calls.length = 0;
  await s.set("A2", "7");
  eq("an unrelated cell disturbs nothing else", l.calls, [["changed", "A2", 7]]);
  eq("inputs are kept as typed", [s.input("B1"), s.input("Z9"), s.input("D1")], ["=A1*10", "", ""]);
  eq("keys in sheet order", s.keys(), ["A1", "B1", "C1", "A2"]);
}

{
  const l = mock<SheetListener>();
  const t = new Sheet(l.it);
  await t.set("B1", "=A1+1");
  await t.set("B1", "=A2+1");
  l.calls.length = 0;
  await t.set("A1", "100");
  eq("a formula changed forgets what it read before", l.calls, [["changed", "A1", 100]]);
  await t.set("A2", "1");
  eq("and follows what it reads now", show(t.value("B1")), "2");
}

{
  const l = mock<SheetListener>();
  const s = new Sheet(l.it);
  await s.setMany([["A1", "1"], ["A2", "2"], ["A3", "=A1+A2"], ["A4", "=A3*2"]]);
  l.calls.length = 0;
  const changed = await s.setMany([["A1", "10"], ["A2", "20"]]);
  eq("a paste recomputes each cell once", l.calls, [["changed", "A1", 10], ["changed", "A2", 20], ["changed", "A3", 30], ["changed", "A4", 60]]);
  eq("and returns them in sheet order", changed, ["A1", "A2", "A3", "A4"]);
  l.calls.length = 0;
  await s.set("A1", "=10");
  eq("a cell that shows the same is not news downstream", l.calls, [["changed", "A1", 10]]);
}

{
  const s = new Sheet();
  await s.set("A1", "=B1");
  await s.set("C1", "=A1*2");
  await s.set("B1", "=A1");
  eq("both cells of a cycle show #CYCLE!, and what reads them", shown(s, "A1", "B1", "C1"), ["#CYCLE!", "#CYCLE!", "#CYCLE!"]);
  eq("problems say which and how", s.problems(), [
    { key: "A1", message: "#CYCLE! a circular reference: A1 → B1 → A1" },
    { key: "B1", message: "#CYCLE! a circular reference: B1 → A1 → B1" },
    { key: "C1", message: "#CYCLE! a circular reference: A1 → B1 → A1" },
  ]);
  await s.set("B1", "4");
  eq("breaking it mends all three", shown(s, "A1", "B1", "C1"), ["4", "4", "8"]);
  eq("no problems left", s.problems(), []);
  await s.set("D1", "=D1+1");
  eq("a cell reading itself", [show(s.value("D1")), s.problems()[0]?.message], ["#CYCLE!", "#CYCLE! a circular reference: D1 → D1"]);
}

{
  const s = new Sheet();
  await s.set("A1", "=1+");
  await s.set("A2", "=A1*2");
  eq("a parse error flows downstream too", shown(s, "A1", "A2"), ["#ERROR!", "#ERROR!"]);
  eq("its problem says where", s.problems()[0], { key: "A1", message: "#ERROR! parse error at 4: expected a value but found the end" });
  await s.set("A1", "");
  eq("clearing a cell makes it empty again", [shown(s, "A1", "A2"), s.keys()], [["", "0"], ["A2"]]);
}

{
  const s = new Sheet();
  throws("a key off the sheet is refused", () => s.set("K1", "1"), RangeError, "K1 is not a cell on the sheet");
  await s.set("b2", "3");
  eq("keys are normalised", [s.input("B2"), s.keys()], ["3", ["B2"]]);
}


// The Sheet against a stub language that records what it was asked: the
// language says what a formula reads and what it comes to; the sheet does
// the order, and waits for each.
const stub = (name: "Excel" | "RexxJS", log: string[]): Language => ({
  name,
  compile(formula) {
    log.push(`${name} compiles ${formula}`);
    const reads = formula.split("+");
    return {
      kind: "formula", reads,
      run: async (env) => {
        log.push(`${name} runs ${formula}`);
        await null;
        return reads.reduce((n, k) => n + Number(env.get(k) ?? 0), 0);
      },
    };
  },
  rewrite: (input) => input,
  functions: () => [],
});
{
  const log: string[] = [];
  const s = new Sheet(undefined, stub("RexxJS", log));
  await s.setMany([["A1", "=B1+C1"], ["B1", "=C1"], ["C1", "2"]]);
  eq("a formula is its language's: compiled once, run in dependency order, each awaited", log,
    ["RexxJS compiles B1+C1", "RexxJS compiles C1", "RexxJS runs C1", "RexxJS runs B1+C1"]);
  eq("to what the language gave", [s.value("A1"), s.value("B1")], [4, 2]);
  log.length = 0;
  await s.setLanguage(stub("Excel", log));
  eq("another language compiles every formula again, and works the sheet out", log,
    ["Excel compiles B1+C1", "Excel compiles C1", "Excel runs C1", "Excel runs B1+C1"]);
  eq("and the sheet says which it speaks", s.language.name, "Excel");
  log.length = 0;
  const first = s.set("C1", "3"), second = s.set("C1", "5");
  await Promise.all([first, second]);
  eq("two settings take turns", [log.filter((l) => l.startsWith("Excel runs C1")).length, s.value("A1")], [2, 10]);
}

// Saved and put back (the workbook's undo is made of these): the cells
// whose input differs set back, and the sheet worked out again.
{
  const s = new Sheet();
  await s.set("A1", "1");
  await s.set("B1", "=A1*2");
  const saved = s.saved();
  await s.set("A1", "5");
  await s.set("C1", "=B1+1");
  eq("restore puts back what changed since, and works the sheet out", [await s.restore(saved), shown(s, "A1", "B1", "C1"), s.keys()], [["A1", "B1", "C1"], ["1", "2", ""], ["A1", "B1"]]);
  eq("restoring what is there changes nothing", await s.restore(s.saved()), []);
  const named = s.saved();
  await s.define("TWO", [{ col: 1, row: 0 }, { col: 1, row: 0 }]);
  await s.set("D1", "=TWO*10");
  await s.restore(named);
  eq("a name goes with it", [s.names(), s.keys()], [[], ["A1", "B1"]]);
}

// expect: ok constants: numbers, text, nothing
// expect: ok a formula
// expect: ok a parse error becomes #ERROR!, with where
// expect: ok refsOf spells out ranges and skips the off-sheet
// expect: ok set returns what changed
// expect: ok formulas read their cells
// expect: ok an edit ripples through everything downstream
// expect: ok and the listener hears each, upstream first
// expect: ok an unrelated cell disturbs nothing else
// expect: ok inputs are kept as typed
// expect: ok keys in sheet order
// expect: ok a formula changed forgets what it read before
// expect: ok and follows what it reads now
// expect: ok a paste recomputes each cell once
// expect: ok and returns them in sheet order
// expect: ok a cell that shows the same is not news downstream
// expect: ok both cells of a cycle show #CYCLE!, and what reads them
// expect: ok problems say which and how
// expect: ok breaking it mends all three
// expect: ok no problems left
// expect: ok a cell reading itself
// expect: ok a parse error flows downstream too
// expect: ok its problem says where
// expect: ok clearing a cell makes it empty again
// expect: ok a key off the sheet is refused
// expect: ok keys are normalised
// expect: ok a formula is its language's: compiled once, run in dependency order, each awaited
// expect: ok to what the language gave
// expect: ok another language compiles every formula again, and works the sheet out
// expect: ok and the sheet says which it speaks
// expect: ok two settings take turns
// expect: ok restore puts back what changed since, and works the sheet out
// expect: ok restoring what is there changes nothing
// expect: ok a name goes with it
