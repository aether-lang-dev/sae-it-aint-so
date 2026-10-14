// site/sheet/rexx.ts: named LAMBDAs in RexxJS formulas. A name's formula
// is LAMBDA(names..., body), its body RexxJS: an expression, or statements
// that LET RESULT. RexxJS's IF() works out only the branch it takes
// (RexxJS d27c738), so one can call itself.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { lambdaOf } from "./sheet/rexx.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

eq("a LAMBDA's parts: its names, its body, statements or not", [lambdaOf("LAMBDA(x, y, x + y)"), lambdaOf("LAMBDA(x, IF(x < 1, 1, x))"), lambdaOf("LAMBDA(n, IF n > 1 THEN LET RESULT = n; ELSE LET RESULT = 1)")],
  [{ params: ["x", "y"], body: "x + y", statements: false }, { params: ["x"], body: "IF(x < 1, 1, x)", statements: false },
    { params: ["n"], body: "IF n > 1 THEN LET RESULT = n; ELSE LET RESULT = 1", statements: true }]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
const value = (k: string) => show(wb.sheet.value(k));
const define = (name: string, formula: string) => message(`names.define name=${name} formula="${formula.replace(/"/g, '""')}"`);
const set = (cell: string, input: string) => cmds.run(`cell.set cell=${cell} input="${input.replace(/"/g, '""')}"`);

await cmds.run("formulas.use language=RexxJS");
await set("A1", "21");
eq("a name for a LAMBDA in RexxJS formulas", await define("DOUBLE", "=LAMBDA(x, x * 2)"), "DOUBLE is =LAMBDA(x, x * 2)");
await set("B1", "=DOUBLE(A1)");
await set("B2", "=DOUBLE(DOUBLE(3)) + 1");
eq("called as a function, in an expression, and in its own argument", [value("B1"), value("B2")], ["42", "13"]);

await define("FACT", "=LAMBDA(n, IF(n < 2, 1, n * FACT(n - 1)))");
await set("C1", "=FACT(10)");
await define("FOREVER", "=LAMBDA(n, FOREVER(n + 1))");
await set("C2", "=FOREVER(1)");
eq("one calls itself and stops (IF works out one branch); one that never stops is #NUM!", [value("C1"), value("C2")], ["3628800", "#NUM!"]);

await define("CLAMP", "=LAMBDA(x, IF x > 10 THEN LET RESULT = 10; ELSE LET RESULT = x)");
await set("C3", "=CLAMP(50) + CLAMP(3)");
eq("a body of statements, clauses split by ;, gives RESULT", value("C3"), "13");

await define("SCALED", "=LAMBDA(x, x * A1)");
await set("C4", "=SCALED(2)");
await set("A1", "5");
eq("what its body reads, the cell that calls it reads", [value("C4"), value("B1")], ["10", "10"]);

await cmds.run('setup.set text="LET TAX_RATE = 0.5"');
await cmds.run("setup.run");
await define("TAXED", "=LAMBDA(Price, price * TAX_RATE)");
await set("C5", "=TAXED(10)");
await define("GREET", '=LAMBDA(who, "Hi " || who)');
await set("C6", '=GREET("Ann") |> UPPER');
eq("the setup script's variables, its names in any case, text and pipes", [value("C5"), value("C6")], ["5", "HI ANN"]);

await set("C7", "=DOUBLE(1, 2)");
eq("given the wrong number of values: #VALUE!", [value("C7"), wb.describe("C7")], ["#VALUE!", "C7: =DOUBLE(1, 2) → #VALUE! DOUBLE takes 1 values, given 2"]);
eq("refusals: not a LAMBDA, no body, a cell as a name", [await define("X", "=A1 * 2"), await define("X", "=LAMBDA(x, )"), await define("X", "=LAMBDA(A1, A1)")],
  ["a named formula in RexxJS formulas is a LAMBDA: =LAMBDA(x, x * 2)", "a LAMBDA needs a body after its names", "a LAMBDA's names are not cells: A1"]);

await cmds.run("names.delete name=DOUBLE");
eq("deleted, what called it fails", value("B1"), "#ERROR!");
await cmds.run("edit.undo");
eq("and one undo brings it back", value("B1"), "10");

// The same LAMBDA in Excel formulas: its body reads the same in both.
await cmds.run("formulas.use language=Excel");
eq("Excel formulas call it too", [value("B1"), value("C1")], ["10", "3628800"]);

// expect: ok a LAMBDA's parts: its names, its body, statements or not
// expect: ok a name for a LAMBDA in RexxJS formulas
// expect: ok called as a function, in an expression, and in its own argument
// expect: ok one calls itself and stops (IF works out one branch); one that never stops is #NUM!
// expect: ok a body of statements, clauses split by ;, gives RESULT
// expect: ok what its body reads, the cell that calls it reads
// expect: ok the setup script's variables, its names in any case, text and pipes
// expect: ok given the wrong number of values: #VALUE!
// expect: ok refusals: not a LAMBDA, no body, a cell as a name
// expect: ok deleted, what called it fails
// expect: ok and one undo brings it back
// expect: ok Excel formulas call it too
