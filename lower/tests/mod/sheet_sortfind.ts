// site/sheet/sortfind.ts: sorting a range's rows by one of its columns, and
// finding and replacing, as the Tauri spreadsheet does (its sortRange, find
// and replace). Each gives [key, input] pairs for one Sheet.setMany.
import { addrOf } from "./sheet/address.ts";
import { found, replaced, sortMoves, sorted, sortedRows } from "./sheet/sortfind.ts";
import { CellNotes } from "./sheet/notes.ts";
import { movedBy } from "./sheet/shift.ts";
import { EXCEL } from "./sheet/excel.ts";
import { Sheet } from "./sheet/sheet.ts";
import { show } from "./sheet/format.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const at = (k: string) => addrOf(k)!;
const sheetOf = async (entries: [string, string][]) => {
  const s = new Sheet();
  await s.setMany(entries);
  return { keys: () => s.keys(), input: (k: string) => s.input(k), value: (k: string): Value => s.value(k), s };
};

const fruit = await sheetOf([
  ["A1", "pear"], ["B1", "3"], ["C1", "=B1*2"],
  ["A2", "apple"], ["B2", "10"], ["C2", "=B2*2"],
  ["A3", "fig"], ["B3", ""], ["C3", "=B3*2"],
  ["A4", "date"], ["B4", "x"], ["C4", "=B4*2"],
]);
eq("sorted by a column, ascending: numbers, then text, then empty", sorted(fruit, at("A1"), at("C4"), 1, true, EXCEL), [
  ["A1", "pear"], ["B1", "3"], ["C1", "=B1*2"],
  ["A2", "apple"], ["B2", "10"], ["C2", "=B2*2"],
  ["A3", "date"], ["B3", "x"], ["C3", "=B3*2"],
  ["A4", "fig"], ["B4", ""], ["C4", "=B4*2"],
]);
eq("descending, by the first column; formulas move with their row", sorted(fruit, at("A1"), at("C4"), 0, false, EXCEL).filter(([k]) => k.startsWith("A") || k === "C1"), [
  ["A1", "pear"], ["C1", "=B1*2"], ["A2", "fig"], ["A3", "date"], ["A4", "apple"],
]);
eq("text compares without case; equal keys keep their order", sorted(await sheetOf([["A1", "b"], ["B1", "1"], ["A2", "B"], ["B2", "2"], ["A3", "a"], ["B3", "3"]]), at("A1"), at("B3"), 0, true, EXCEL),
  [["A1", "a"], ["B1", "3"], ["A2", "b"], ["B2", "1"], ["A3", "B"], ["B3", "2"]]);
eq("the row each place takes, for notes to follow", sortedRows(fruit, at("A1"), at("C4"), 0, true), [1, 3, 2, 0]);
{
  const notes = new CellNotes();
  notes.set("C1", { format: "0.0", styleExpression: 'IF(C1 > 5, "color: red", "")' });
  notes.set("E1", { comment: "outside the range" });
  notes.remap(sortMoves(fruit, at("A1"), at("C4"), 0, true), (e, from, to) => movedBy(EXCEL, `=${e}`, { cols: 0, rows: to.row - from.row }).slice(1));
  eq("notes follow their row in a sort, a conditional style rewritten with it", [notes.get("C4"), notes.get("C1"), notes.get("E1")],
    [{ format: "0.0", styleExpression: 'IF(C4 > 5, "color: red", "")' }, {}, { comment: "outside the range" }]);
}
{
  const { s } = fruit;
  await s.setMany(sorted(fruit, at("A1"), at("C4"), 0, true, EXCEL));
  eq("through a Sheet: each row's formula still reads its own row", ["A1", "C1", "A4", "C4"].map((k) => show(s.value(k))), ["apple", "20", "pear", "6"]);
}

const ledger = await sheetOf([["A1", "Rent"], ["B1", "=100*2"], ["A2", "rent due"], ["B2", "200"], ["A3", "Food"], ["B3", "=B1+B2"]]);
eq("find: in what cells show, any case, part of a cell", found(ledger, "rent", {}), ["A1", "A2"]);
eq("matching case", found(ledger, "rent", { matchCase: true }), ["A2"]);
eq("the whole cell", found(ledger, "rent", { wholeCell: true }), ["A1"]);
eq("values, not formulas, unless asked", [found(ledger, "200", {}), found(ledger, "B1", {}), found(ledger, "B1", { inFormulas: true })], [["B1", "B2"], [], ["B3"]]);
eq("replace: in constants, every match in a cell, any case", replaced(ledger, "rent", "Lease", {}), [["A1", "Lease"], ["A2", "Lease due"]]);
eq("formulas only when asked, and then their text", [replaced(ledger, "B1", "B2", {}), replaced(ledger, "B1", "B2", { inFormulas: true })], [[], [["B3", "=B2+B2"]]]);
eq("whole cells only", replaced(ledger, "rent", "Lease", { wholeCell: true }), [["A1", "Lease"]]);
eq("a pattern's characters are just characters", replaced(await sheetOf([["A1", "a.b (c)"]]), ".b (", "-", {}), [["A1", "a-c)"]]);
// expect: ok sorted by a column, ascending: numbers, then text, then empty
// expect: ok descending, by the first column; formulas move with their row
// expect: ok text compares without case; equal keys keep their order
// expect: ok the row each place takes, for notes to follow
// expect: ok notes follow their row in a sort, a conditional style rewritten with it
// expect: ok through a Sheet: each row's formula still reads its own row
// expect: ok find: in what cells show, any case, part of a cell
// expect: ok matching case
// expect: ok the whole cell
// expect: ok values, not formulas, unless asked
// expect: ok replace: in constants, every match in a cell, any case
// expect: ok formulas only when asked, and then their text
// expect: ok whole cells only
// expect: ok a pattern's characters are just characters
