// site/rexxsheet/: the Tauri spreadsheet's model, adapter and function
// library (RexxJS/example-app-spreadsheet) on sae's engine, with RexxJS
// itself bundled from vendor/rexxjs. Formulas are RexxJS expressions.
import { load, rexxSheet } from "./rexxsheet/boot.ts";
import type { RexxSheet } from "./rexxsheet/boot.ts";
import { SAMPLE_BUDGET, TEST_SHEET } from "./rexxsheet/samples.ts";
import { eq } from "./lib/check.ts";

const value = (s: RexxSheet, ref: string) => String(s.model.getCellValue(ref));
const error = (s: RexxSheet, ref: string) => String(s.model.getCell(ref).error ?? "").split("\n").pop();
const stored = (data: any) => Object.entries(data.cells).map(([ref, c]: [string, any]) => `${ref}=${c.value}`);
const shown = (s: RexxSheet, data: any) => Object.keys(data.cells).map((ref) => `${ref}=${value(s, ref)}`);

for (const data of [TEST_SHEET, SAMPLE_BUDGET] as any[]) {
  const s = await rexxSheet();
  await load(s, data);
  eq(`${data.name}: every cell comes to the value the file stored`, shown(s, data), stored(data));
}

const s = await rexxSheet();
await load(s, SAMPLE_BUDGET);
await s.model.setCell("B2", "1000", s.adapter);
eq("an edit ripples: tax, total, and the sums below", ["C2", "D2", "B6", "D6"].map((r) => value(s, r)), ["80", "1080", "1100", "1188"]);
eq("the setup script's variables are there for every cell", (await s.model.setCell("E1", "=TAX_RATE * 100", s.adapter), value(s, "E1")), "8");

const formula = async (ref: string, f: string) => {
  await s.model.setCell(ref, f, s.adapter);
  return value(s, ref);
};
eq("Rexx's own: || and |>", [await formula("E2", "=UPPER(A2) || '!'"), await formula("E3", "=A2 |> LOWER")], ["LAPTOP!", "laptop"]);
eq("Rexx's string functions", [await formula("E4", "=SUBSTR(A3, 1, 3)"), await formula("E5", "=WORD('the quick fox', 2)"), await formula("E6", "=COPIES('ab', 3)")], ["Mou", "quick", "ababab"]);
eq("the app's range functions", [await formula("E7", '=MAX_RANGE("B2:B4")'), await formula("E8", '=COUNT_RANGE("A2:A4")')], ["1000", "3"]);
eq("constants alone are an expression too", await formula("E9", "=2*3"), "6");
eq("an error says why", [await formula("E10", "=1/0"), error(s, "E10")], ["#ERROR!", "Division by zero"]);
eq("an unknown function", [await formula("E11", "=NOSUCH(1)"), error(s, "E11").startsWith("Function NOSUCH is not available")], ["#ERROR!", true]);

await s.model.setCell("F1", "=F2", s.adapter);
await s.model.setCell("F2", "=F1 + 1", s.adapter);
eq("a cycle is #CIRCULAR! on each cell, with the route", [value(s, "F1"), value(s, "F2"), error(s, "F1")], ["#CIRCULAR!", "#CIRCULAR!", "Circular reference: F2 → F1 → F2"]);
await s.model.setCell("F2", "5", s.adapter);
eq("and mends when broken", [value(s, "F1"), value(s, "F2"), error(s, "F1")], ["5", "5", ""]);
await s.model.setCell("B2", "", s.adapter);
eq("clearing a cell ripples too", [s.model.cells.has("B2"), value(s, "B6")], [false, "100"]);
// expect: ok Test Sheet: every cell comes to the value the file stored
// expect: ok Sample Budget: every cell comes to the value the file stored
// expect: ok an edit ripples: tax, total, and the sums below
// expect: ok the setup script's variables are there for every cell
// expect: ok Rexx's own: || and |>
// expect: ok Rexx's string functions
// expect: ok the app's range functions
// expect: ok constants alone are an expression too
// expect: ok an error says why
// expect: ok an unknown function
// expect: ok a cycle is #CIRCULAR! on each cell, with the route
// expect: ok and mends when broken
// expect: ok clearing a cell ripples too
