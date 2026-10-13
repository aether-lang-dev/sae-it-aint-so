// The Tauri spreadsheet's query functions (its public/lib/spreadsheet-
// functions.js), in RexxJS formulas: RANGE("A1:D5") or TABLE("sales"), then
// WHERE, PLUCK, GROUP_BY, SUM, AVG, COUNT and RESULT along a pipe. The query
// is site/sheet/query.ts, pure; WHERE's condition is RexxJS, worked out a
// row at a time with each column's name bound to the row's value (the app
// uses JavaScript's eval there, which sae must not). What a formula comes
// to spills: rows, a column, or a group's key beside its aggregate.
import { aggregate, columnIndex, groupBy, pluck, queryOf, result, where } from "./sheet/query.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const table: Value[][] = [["region", "product", "amount", "qty"], ["North", "pens", 120, 3], ["South", "ink", 80, 1], ["North", "paper", 40, 2], ["West", "pens", 300, 5]];
const q = queryOf(table, 0);
eq("a header row is found: text above, numbers below", [q.headers, q.rows.length, queryOf(table.slice(1), 0).headers], [["region", "product", "amount", "qty"], 4, null]);
eq("a column by its name (any case), its letter, or its index", [columnIndex(q, "Amount"), columnIndex(q, "B"), columnIndex(q, 3), columnIndex(queryOf(table, 2), "D")], [2, 1, 3, 1]);
eq("one that is not there", (() => { try { return columnIndex(q, "price"); } catch (e) { return (e as Error).message; } })(), "no column price");
eq("where, pluck", [await (async () => result(await where(q, async (col) => (col("amount") as number) > 100)))(), pluck(q, "product")],
  [[["North", "pens", 120, 3], ["West", "pens", 300, 5]], [["pens"], ["ink"], ["paper"], ["pens"]]]);
const byRegion = groupBy(q, "region");
eq("group by: aggregates per group, in the order groups first appear", [aggregate(byRegion, "sum", "amount"), aggregate(byRegion, "count"), aggregate(byRegion, "avg", "qty")],
  [[["North", 160], ["South", 80], ["West", 300]], [["North", 2], ["South", 1], ["West", 1]], [["North", 2.5], ["South", 1], ["West", 5]]]);
eq("and over every row when not grouped", [aggregate(q, "sum", "amount"), aggregate(q, "count"), aggregate(q, "avg", "amount")], [540, 4, 135]);
eq("a grouped query's rows: group by group", result(byRegion).map((r) => r[1]), ["pens", "paper", "ink", "pens"]);

const wb = new Workbook();
const cmds = new Commands(wb);
const set = (cell: string, input: string) => cmds.run(`cell.set cell=${cell} input="${input.replace(/"/g, '""')}"`);
const shown = (...keys: string[]) => keys.map((k) => show(wb.sheet.value(k)));
await cmds.run("formulas.use language=RexxJS");
for (const [r, row] of table.entries()) for (const [c, v] of row.entries()) await set(`${"ABCD"[c]}${r + 1}`, String(v));

await set("F1", `=RANGE("A1:D5") |> WHERE("amount > 100") |> RESULT()`);
eq("RexxJS: WHERE's condition is RexxJS over the row's columns; RESULT's rows spill", shown("F1", "G1", "H1", "F2", "H2", "F3"), ["North", "pens", "120", "West", "300", ""]);
await set("F5", `=RANGE("A1:D5") |> GROUP_BY("region") |> SUM("amount")`);
eq("GROUP_BY then SUM: each group's key beside its sum", shown("F5", "G5", "F6", "G6", "F7", "G7"), ["North", "160", "South", "80", "West", "300"]);
await set("F9", `=RANGE("A1:D5") |> WHERE("region = 'North' & qty >= 2") |> COUNT()`);
await set("F10", `=RANGE("A2:D5") |> WHERE("column_C > 100") |> SUM("C")`);
await set("F11", `=RANGE("A1:D5") |> WHERE("UPPER(product) == 'PENS'") |> AVG("amount")`);
eq("COUNT, letters with no header row, Rexx's functions in a condition", shown("F9", "F10", "F11"), ["2", "420", "210"]);
await set("C3", "500");
eq("a query follows the cells it reads", shown("F6", "G6", "F10"), ["South", "500", "920"]);
await set("F12", `=RANGE("A1:D5") |> PLUCK("product")`);
eq("PLUCK spills a column", shown("F12", "F13", "F15"), ["pens", "ink", "pens"]);
await set("H12", `=RANGE("A1:D5") |> WHERE("price > 1")`);
await set("H13", `=RANGE("A1:D5") |> WHERE("amount >") |> COUNT()`);
eq("errors say why", [String((wb.sheet.value("H12") as CellError).why), shown("H13")], ["no column price", ["#ERROR!"]]);

eq("table.define: a name for a table, its header row its columns' names", [(await cmds.run("table.define name=Sales range=A1:D5 headers=1")).message, (await cmds.run("table.list")).output],
  ["Sales is A1:D5, with columns region, product, amount, qty", ["Sales A1:D5 (region, product, amount, qty)"]]);
await set("H15", `=TABLE("sales") |> GROUP_BY("product") |> COUNT()`);
eq("TABLE reads it, any case", shown("H15", "I15", "H16", "I16"), ["pens", "2", "ink", "1"]);
await cmds.run("table.define name=Plain range=A2:D5 columns=where,what,much,many");
await set("J5", `=TABLE("Plain") |> WHERE("much < 100") |> PLUCK("what")`);
eq("columns named in the definition, for a table with no header row", shown("J5", "J6"), ["paper", ""]);
eq("refusals", [(await cmds.run("table.define name=1x range=A1:B2")).message, (await cmds.run("table.define name=T range=A1:B2 columns=a")).message, (await cmds.run("table.delete name=nope")).message],
  ["1x is not a table name: a letter first, then letters, digits or _", "T has 2 columns, and 1 name", "no table nope"]);
await cmds.run("rows.insert at=1");
eq("tables move with inserted rows", (await cmds.run("table.list")).output, ["Plain A3:D6 (where, what, much, many)", "Sales A2:D6 (region, product, amount, qty)"]);
const written = JSON.parse(JSON.stringify(writeSheetFile(wb)));
eq("saved with the sheet, and read back", [written.tables, readSheetFile(written).sheets[0].tables.map((t) => t.name)],
  [[{ name: "Plain", range: "A3:D6", headers: false, columns: ["where", "what", "much", "many"] }, { name: "Sales", range: "A2:D6", headers: true, columns: null }], ["Plain", "Sales"]]);
eq("table.delete", [(await cmds.run("table.delete name=plain")).message, (await cmds.run("table.list")).output], ["deleted Plain", ["Sales A2:D6 (region, product, amount, qty)"]]);
eq("a script's GROUP_BY is the sheet's, not RexxJS's own over arrays", (await cmds.script(`LET g = GROUP_BY("A1:B2", "region")`, () => {})).message,
  "GROUP_BY takes a query: RANGE(...) or TABLE(...) |> GROUP_BY(...)");
// expect: ok a header row is found: text above, numbers below
// expect: ok a column by its name (any case), its letter, or its index
// expect: ok one that is not there
// expect: ok where, pluck
// expect: ok group by: aggregates per group, in the order groups first appear
// expect: ok and over every row when not grouped
// expect: ok a grouped query's rows: group by group
// expect: ok RexxJS: WHERE's condition is RexxJS over the row's columns; RESULT's rows spill
// expect: ok GROUP_BY then SUM: each group's key beside its sum
// expect: ok COUNT, letters with no header row, Rexx's functions in a condition
// expect: ok a query follows the cells it reads
// expect: ok PLUCK spills a column
// expect: ok errors say why
// expect: ok table.define: a name for a table, its header row its columns' names
// expect: ok TABLE reads it, any case
// expect: ok columns named in the definition, for a table with no header row
// expect: ok refusals
// expect: ok tables move with inserted rows
// expect: ok saved with the sheet, and read back
// expect: ok table.delete
// expect: ok a script's GROUP_BY is the sheet's, not RexxJS's own over arrays
