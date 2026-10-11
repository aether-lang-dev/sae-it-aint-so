// site/sheet/rexx.ts: "RexxJS formulas", the sheet's other language, as the
// Tauri spreadsheet (RexxJS/example-app-spreadsheet) has them, and file.ts
// reading that app's sheet files. RexxJS is the vendored bundle.
import { RexxLanguage } from "./sheet/rexx.ts";
import { movedBy } from "./sheet/shift.ts";
import { Sheet } from "./sheet/sheet.ts";
import { readSheetFile } from "./sheet/file.ts";
import { SAMPLE_BUDGET, TEST_SHEET } from "./sheet/samples.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const rexx = new RexxLanguage();
const run = async (formula: string, cells: Record<string, Value> = {}): Promise<string> => {
  const f = rexx.compile(formula);
  if (f.kind === "broken") return `${f.error.code} ${f.error.why}`;
  const v = await f.run({ get: (k) => cells[k] ?? null });
  return v instanceof CellError ? `${v.code} ${v.why}` : show(v);
};

eq("what a formula reads: its cells, any case, and a range's, even in a string", rexx.compile('A1 + SUM_RANGE("B1:B3") * c2 + a1').kind === "formula" && rexx.compile('A1 + SUM_RANGE("B1:B3") * c2 + a1').reads,
  ["A1", "B1", "B2", "B3", "C2"]);
eq("but not a function's name, nor a cell off the sheet", rexx.compile("LOG10(K1) + MD5(A2)").kind === "formula" && (rexx.compile("LOG10(K1) + MD5(A2)") as any).reads, ["A2"]);

eq("arithmetic on cells", await run("A1 + B1 * 2", { A1: 2, B1: 3 }), "8");
eq("Rexx's own: || and |>", [await run("UPPER(A2) || '!'", { A2: "pears" }), await run("A2 |> LOWER", { A2: "PEARS" })], ["PEARS!", "pears"]);
eq("string functions", [await run("SUBSTR('hello', 2, 3)"), await run("WORD('the quick fox', 2)"), await run("COPIES('ab', 3)")], ["ell", "quick", "ababab"]);
eq("a comparison is 1 or 0", [await run("A1 > 500", { A1: 1200 }), await run("(A1 > 500) + (A2 = 'x')", { A1: 1, A2: "x" })], ["1", "1"]);
eq("an empty cell is an empty string", await run("LENGTH(A9)"), "0");
eq("constants alone are a formula too", await run("2*3"), "6");
eq("an error is #ERROR!, with RexxJS's reason", [await run("1/0"), await run("NOSUCH(1)")],
  ["#ERROR! Division by zero", "#ERROR! Function NOSUCH is not available: See https://rexxjs.org/functions/missing/ for help with missing functions and REQUIRE."]);
eq("an error a formula reads is that error", await run("A1 + 1", { A1: new CellError("#DIV/0!", "divide by zero") }), "#DIV/0! divide by zero");

eq("a setup script defines what every formula can use", [await rexx.setup("LET TAX_RATE = 0.08"), await run("TAX_RATE * 100")], [null, "8"]);
eq("one that fails says why", (await rexx.setup("LET X = 1/0"))?.split("\n").pop(), "Division by zero");

const cells: Record<string, Value> = { A1: 1, A2: 2, A3: "x", A4: 4, A5: null, B1: 10 };
eq("the app's range functions", [
  await run('SUM_RANGE("A1:A5")', cells), await run('AVERAGE_RANGE("A1:A5")', cells), await run('COUNT_RANGE("A1:A5")', cells),
  await run('MIN_RANGE("A1:A5")', cells), await run('MAX_RANGE("A1:A5")', cells), await run('MEDIAN_RANGE("A1:A5")', cells), await run('PRODUCT_RANGE("A1:A5")', cells),
].map(String), ["7", "2.333333333", "4", "1", "4", "2", "8"]);
eq("and the spread ones", [await run('STDEV_RANGE("A1:A4")', cells), await run('STDEVP_RANGE("A1:A4")', cells), await run('VAR_RANGE("A1:A4")', cells), await run('VARP_RANGE("A1:A4")', cells)],
  ["1.527525232", "1.247219129", "2.333333333", "1.555555556"]);
eq("conditional sums and counts", [await run('SUMIF_RANGE("A1:A5", ">1")', cells), await run('COUNTIF_RANGE("A1:A5", "<>2")', cells)], ["6", "2"]);
eq("CELL by name; a range across columns", [await run('CELL("B1")', cells), await run('SUM_RANGE("A1:B1")', cells)], ["10", "11"]);
eq("a condition the app does not read", await run('SUMIF_RANGE("A1:A5", "big")', cells), '#ERROR! Invalid condition format. Use: ">5", "=10", "<100", etc.');

eq("a copy moves its references, in strings too", movedBy(rexx, '=A1 + SUM_RANGE("B1:B3")', { cols: 1, rows: 1 }), '=B2 + SUM_RANGE("C2:C4")');
eq("$ fixes; off the sheet is #REF!", [movedBy(rexx, "=$A1 + A$1", { cols: 1, rows: 1 }), movedBy(rexx, "=J1 * 2", { cols: 1, rows: 0 })], ["=$A2 + B$1", "=#REF! * 2"]);
eq("a constant is not moved", movedBy(rexx, "A1", { cols: 1, rows: 1 }), "A1");

for (const data of [TEST_SHEET, SAMPLE_BUDGET] as any[]) {
  const file = readSheetFile(data);
  const lang = new RexxLanguage();
  await lang.setup(file.setupScript);
  const s = new Sheet(undefined, lang);
  await s.setMany(file.entries);
  eq(`${data.name}: every cell comes to the value the file stored`,
    Object.keys(data.cells).map((k) => `${k}=${show(s.value(k))}`), Object.entries(data.cells).map(([k, c]: [string, any]) => `${k}=${c.value}`));
}
{
  const file = readSheetFile(SAMPLE_BUDGET);
  eq("a sheet file: its language, its setup script, its inputs and comments", [file.language, file.setupScript.split("\n")[1], file.entries.slice(0, 3), file.notes.get("A1")?.comment],
    ["RexxJS", "LET TAX_RATE = 0.08", [["A1", "Item"], ["B1", "Price"], ["C1", "Tax"]], "Item name"]);
  eq("a formula is its expression after =", file.entries.find(([k]) => k === "C2"), ["C2", "=B2 * TAX_RATE"]);
  eq("one that says Excel is Excel", readSheetFile({ formulas: "excel", cells: { A1: { value: "1", expression: "SUM(B1:B2)" } } }).language, "Excel");
}
// expect: ok what a formula reads: its cells, any case, and a range's, even in a string
// expect: ok but not a function's name, nor a cell off the sheet
// expect: ok arithmetic on cells
// expect: ok Rexx's own: || and |>
// expect: ok string functions
// expect: ok a comparison is 1 or 0
// expect: ok an empty cell is an empty string
// expect: ok constants alone are a formula too
// expect: ok an error is #ERROR!, with RexxJS's reason
// expect: ok an error a formula reads is that error
// expect: ok a setup script defines what every formula can use
// expect: ok one that fails says why
// expect: ok the app's range functions
// expect: ok and the spread ones
// expect: ok conditional sums and counts
// expect: ok CELL by name; a range across columns
// expect: ok a condition the app does not read
// expect: ok a copy moves its references, in strings too
// expect: ok $ fixes; off the sheet is #REF!
// expect: ok a constant is not moved
// expect: ok Test Sheet: every cell comes to the value the file stored
// expect: ok Sample Budget: every cell comes to the value the file stored
// expect: ok a sheet file: its language, its setup script, its inputs and comments
// expect: ok a formula is its expression after =
// expect: ok one that says Excel is Excel
