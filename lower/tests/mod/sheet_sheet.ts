// site/sheet/sheet.ts against a mock listener: edits ripple downstream in
// dependency order, a paste recomputes each cell once, cycles are found and
// mended, and old dependencies are forgotten.
import { Sheet, compile, pasted, refsOf } from "./sheet/sheet.ts";
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
  eq("set returns what changed", s.set("A1", "2"), ["A1"]);
  s.set("B1", "=A1*10");
  s.set("C1", "=B1+A1");
  eq("formulas read their cells", shown(s, "A1", "B1", "C1"), ["2", "20", "22"]);
  l.calls.length = 0;
  eq("an edit ripples through everything downstream", s.set("A1", "5"), ["A1", "B1", "C1"]);
  eq("and the listener hears each, upstream first", l.calls, [["changed", "A1", 5], ["changed", "B1", 50], ["changed", "C1", 55]]);
  l.calls.length = 0;
  s.set("A2", "7");
  eq("an unrelated cell disturbs nothing else", l.calls, [["changed", "A2", 7]]);
  eq("inputs are kept as typed", [s.input("B1"), s.input("Z9"), s.input("D1")], ["=A1*10", "", ""]);
  eq("keys in sheet order", s.keys(), ["A1", "B1", "C1", "A2"]);
}

{
  const l = mock<SheetListener>();
  const t = new Sheet(l.it);
  t.set("B1", "=A1+1");
  t.set("B1", "=A2+1");
  l.calls.length = 0;
  t.set("A1", "100");
  eq("a formula changed forgets what it read before", l.calls, [["changed", "A1", 100]]);
  t.set("A2", "1");
  eq("and follows what it reads now", show(t.value("B1")), "2");
}

{
  const l = mock<SheetListener>();
  const s = new Sheet(l.it);
  s.setMany([["A1", "1"], ["A2", "2"], ["A3", "=A1+A2"], ["A4", "=A3*2"]]);
  l.calls.length = 0;
  const changed = s.setMany([["A1", "10"], ["A2", "20"]]);
  eq("a paste recomputes each cell once", l.calls, [["changed", "A1", 10], ["changed", "A2", 20], ["changed", "A3", 30], ["changed", "A4", 60]]);
  eq("and returns them in sheet order", changed, ["A1", "A2", "A3", "A4"]);
  l.calls.length = 0;
  s.set("A1", "=10");
  eq("a cell that shows the same is not news downstream", l.calls, [["changed", "A1", 10]]);
}

{
  const s = new Sheet();
  s.set("A1", "=B1");
  s.set("C1", "=A1*2");
  s.set("B1", "=A1");
  eq("both cells of a cycle show #CYCLE!, and what reads them", shown(s, "A1", "B1", "C1"), ["#CYCLE!", "#CYCLE!", "#CYCLE!"]);
  eq("problems say which and how", s.problems(), [
    { key: "A1", message: "#CYCLE! a circular reference: A1 → B1 → A1" },
    { key: "B1", message: "#CYCLE! a circular reference: B1 → A1 → B1" },
    { key: "C1", message: "#CYCLE! a circular reference: A1 → B1 → A1" },
  ]);
  s.set("B1", "4");
  eq("breaking it mends all three", shown(s, "A1", "B1", "C1"), ["4", "4", "8"]);
  eq("no problems left", s.problems(), []);
  s.set("D1", "=D1+1");
  eq("a cell reading itself", [show(s.value("D1")), s.problems()[0]?.message], ["#CYCLE!", "#CYCLE! a circular reference: D1 → D1"]);
}

{
  const s = new Sheet();
  s.set("A1", "=1+");
  s.set("A2", "=A1*2");
  eq("a parse error flows downstream too", shown(s, "A1", "A2"), ["#ERROR!", "#ERROR!"]);
  eq("its problem says where", s.problems()[0], { key: "A1", message: "#ERROR! parse error at 4: expected a value but found the end" });
  s.set("A1", "");
  eq("clearing a cell makes it empty again", [shown(s, "A1", "A2"), s.keys()], [["", "0"], ["A2"]]);
}

{
  const s = new Sheet();
  throws("a key off the sheet is refused", () => s.set("K1", "1"), RangeError, "K1 is not a cell on the sheet");
  s.set("b2", "3");
  eq("keys are normalised", [s.input("B2"), s.keys()], ["3", ["B2"]]);
}

eq("pasted places rows of tabs at a cell", pasted("a\tb\n1\t=A2\n", { col: 1, row: 0 }), [["B1", "a"], ["C1", "b"], ["B2", "1"], ["C2", "=A2"]]);
eq("and drops what falls off the sheet", pasted("1\t2\t3\r\n4\t5\t6", { col: 8, row: 19 }), [["I20", "1"], ["J20", "2"]]);
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
// expect: ok pasted places rows of tabs at a cell
// expect: ok and drops what falls off the sheet
