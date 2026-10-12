// LET and LAMBDA in Excel formulas: names bound in a formula, each value
// seeing the names before it; a LAMBDA a value that is called (at once,
// LAMBDA(x, x*2)(5), or through a name), its body seeing the names where it
// was written. The parser knows which names are bound where; the evaluator
// keeps the scopes.
import { evaluate } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { print } from "./sheet/audit.ts";
import { EXCEL } from "./sheet/excel.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const cells = new Map<string, Value>([["A1", 4], ["B2", 10]]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const ev = (...srcs: string[]): string[] => srcs.map((src) => {
  try {
    const v = evaluate(parse(src, () => null), env);
    return v instanceof CellError ? `${v.code} ${v.why}` : show(v as Value);
  } catch (e) {
    return `parse: ${(e as Error).message}`;
  }
});

eq("LET: a name for a value", ev("LET(x, 2, x*3)", "LET(x, A1, y, x+1, x*y)", "let(Rate, 0.5, rate*B2)"), ["6", "20", "5"]);
eq("an inner LET's name hides an outer one's", ev("LET(x, 1, LET(x, 2, x) + x)"), ["3"]);
eq("a name is not there before it is bound, nor outside its LET", ev("LET(x, y, y, 1, x)", "LET(x, 1, x) + x"), ["#NAME? no name Y", "#NAME? no name X"]);
eq("LET's names are names, not cells; and it ends in a value", ev("LET(A1, 2, A1)", "LET(x, 1)"), ["parse: LET's names are names, not cells: A1", "parse: LET needs a name, its value, and then the value it comes to"]);
eq("LAMBDA called at once, or by a name", ev("LAMBDA(x, x*2)(5)", "LET(f, LAMBDA(x, y, x+y), f(2, 3))", "LET(sq, LAMBDA(n, n*n), sq(sq(2)))"), ["10", "5", "16"]);
eq("its body sees the names where it was written", ev("LET(k, 10, f, LAMBDA(x, x+k), LET(k, 1, f(1)))"), ["11"]);
eq("given the wrong number of values", ev("LAMBDA(x, y, x)(1)"), ["#VALUE! LAMBDA takes 2 values, given 1"]);
eq("a formula whose value is a LAMBDA is #CALC!", ev("LAMBDA(x, x)", "LET(f, LAMBDA(x, x), f)"), ["#CALC! a formula's value is a LAMBDA: call it", "#CALC! a formula's value is a LAMBDA: call it"]);
eq("what it reads: its cells, not its names", (() => {
  const f = EXCEL.compile("LET(x, A1, y, x + B2, LAMBDA(z, z + C3)(y))");
  return f.kind === "formula" ? f.reads : f.error.why;
})(), ["A1", "B2", "C3"]);
eq("printed", [print(parse("let(x,1,x+1)", () => null)), print(parse("LAMBDA(x, x*2)(5)", () => null))], ["LET(X,1,X+1)", "LAMBDA(X,X*2)(5)"]);

const wb = new Workbook();
const cmds = new Commands(wb);
await cmds.run("cell.set cell=A1 input=3");
await cmds.run('cell.set cell=B1 input="=LET(x, A1, sq, LAMBDA(n, n*n), sq(x) + 1)"');
await cmds.run("cell.set cell=A1 input=5");
eq("in a sheet: follows the cells it reads", show(wb.sheet.value("B1")), "26");
await cmds.run("edit.copy range=B1");
await cmds.run("edit.paste at=B2");
eq("a copy moves its references, not its names", wb.sheet.input("B2"), "=LET(x, A2, sq, LAMBDA(n, n*n), sq(x) + 1)");
// expect: ok LET: a name for a value
// expect: ok an inner LET's name hides an outer one's
// expect: ok a name is not there before it is bound, nor outside its LET
// expect: ok LET's names are names, not cells; and it ends in a value
// expect: ok LAMBDA called at once, or by a name
// expect: ok its body sees the names where it was written
// expect: ok given the wrong number of values
// expect: ok a formula whose value is a LAMBDA is #CALC!
// expect: ok what it reads: its cells, not its names
// expect: ok printed
// expect: ok in a sheet: follows the cells it reads
// expect: ok a copy moves its references, not its names
