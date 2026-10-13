// Pivot tables (site/sheet/pivot.ts), the Tauri spreadsheet's CREATEPIVOT:
// first the grid alone, then through the commands: written from a cell,
// written again on update (what it no longer covers cleared), moved with
// rows, saved, forgotten.
import { pivoted } from "./sheet/pivot.ts";
import type { PivotFields } from "./sheet/pivot.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { readSheetFile, writeSheetFile } from "./sheet/file.ts";
import { show } from "./sheet/format.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const sales: Value[][] = [["region", "product", "amount"], ["North", "pens", 10], ["South", "ink", 4], ["North", "ink", 6], ["North", "pens", 5], ["South", "pens", "n/a"]];
const fields = (f: Partial<PivotFields>): PivotFields => ({ rows: [], cols: [], value: "amount", agg: "SUM", filters: {}, ...f });
eq("rows grouped down the side, an aggregate beside each, in the order they first appear", pivoted(sales, fields({ rows: ["region"] })),
  [["region", "SUM of amount"], ["North", "21"], ["South", "4"]]);
eq("and across the top: 0 where no row met", pivoted(sales, fields({ rows: ["region"], cols: ["product"] })),
  [["region", "pens", "ink"], ["North", "15", "6"], ["South", "0", "4"]]);
eq("COUNT, AVERAGE, MIN and MAX of the numbers (text is not one)", ["COUNT", "AVERAGE", "MIN", "MAX"].map((agg) => pivoted(sales, fields({ rows: ["region"], agg: agg as PivotFields["agg"] }))[1][1]),
  ["3", "7", "5", "10"]);
eq("filters keep the rows with that value; two row fields", pivoted(sales, fields({ rows: ["region", "product"], filters: { region: "North" } })),
  [["region", "product", "SUM of amount"], ["North", "pens", "15"], ["North", "ink", "6"]]);
eq("a field not in the first row", (() => { try { return pivoted(sales, fields({ rows: ["colour"] })); } catch (e) { return (e as Error).message; } })(), "no field colour (region, product, amount)");

const wb = new Workbook();
const cmds = new Commands(wb);
for (const [r, row] of sales.entries()) for (const [c, v] of row.entries()) await cmds.run(`cell.set cell=${"ABC"[c]}${r + 1} input="${v}"`);
const area = (a: string, rows: number, cols: number) => Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => show(wb.sheet.value(`${String.fromCharCode(a.charCodeAt(0) + c)}${r + 1 + Number(a.slice(1)) - 1}`))));
eq("pivot.create writes it from a cell", [(await cmds.run("pivot.create id=bySide source=A1:C6 value=amount agg=sum output=E1 rows=region cols=product")).message, area("E1", 3, 3)],
  ["pivot bySide at E1:G3: 9 cells set, 9 changed", [["region", "pens", "ink"], ["North", "15", "6"], ["South", "0", "4"]]]);
await cmds.run("cell.set cell=C3 input=40");
eq("pivot.update writes it again from its source", [(await cmds.run("pivot.update id=bySide")).ok, area("E1", 3, 3)[2]], [true, ["South", "0", "40"]]);
await cmds.run("pivot.create id=bySide source=A1:C6 value=amount agg=count output=E1 rows=region");
eq("the same id again replaces it, clearing what it no longer covers", area("E1", 3, 3), [["region", "COUNT of amount", ""], ["North", "3", ""], ["South", "1", ""]]);
eq("pivot.get and pivot.list, as the app's GETPIVOT and LISTPIVOTS", [(await cmds.run("pivot.get id=bySide")).output, (await cmds.run("pivot.list")).output],
  [{ sourceRange: "A1:C6", rowFields: ["region"], colFields: [], valueField: "amount", aggFunction: "COUNT", outputCell: "E1", filters: {} },
    [{ id: "bySide", config: { sourceRange: "A1:C6", rowFields: ["region"], colFields: [], valueField: "amount", aggFunction: "COUNT", outputCell: "E1", filters: {} } }]]);
eq("refusals: an aggregate, a field, the edge of the sheet, a pivot not there", [
  (await cmds.run("pivot.create id=x source=A1:C6 value=amount agg=median output=E1")).message, (await cmds.run("pivot.create id=x source=A1:C6 value=price agg=sum output=E1")).message,
  (await cmds.run("pivot.create id=x source=A1:C6 value=amount agg=sum output=Z100 rows=region")).message, (await cmds.run("pivot.update id=nope")).message,
], ["median is not SUM, COUNT, AVERAGE, MIN, MAX", "no field price (region, product, amount)", "pivot x is 3 rows by 2 columns: it does not fit from Z100", "no pivot nope"]);
await cmds.run("rows.insert at=1");
eq("it moves with inserted rows", (await cmds.run("pivot.get id=bySide")).output!.sourceRange, "A2:C7");
const read = readSheetFile(JSON.parse(JSON.stringify(writeSheetFile(wb))));
eq("saved, and read back", read.sheets[0].pivots.map(([id, pv]) => [id, pv.agg, pv.written]), [["bySide", "COUNT", [{ col: 4, row: 1 }, { col: 5, row: 3 }]]]);
eq("pivot.delete forgets it; its cells stay", [(await cmds.run("pivot.delete id=bySide")).message, (await cmds.run("pivot.list")).output, show(wb.sheet.value("E2"))], ["deleted pivot bySide", [], "region"]);
// expect: ok rows grouped down the side, an aggregate beside each, in the order they first appear
// expect: ok and across the top: 0 where no row met
// expect: ok COUNT, AVERAGE, MIN and MAX of the numbers (text is not one)
// expect: ok filters keep the rows with that value; two row fields
// expect: ok a field not in the first row
// expect: ok pivot.create writes it from a cell
// expect: ok pivot.update writes it again from its source
// expect: ok the same id again replaces it, clearing what it no longer covers
// expect: ok pivot.get and pivot.list, as the app's GETPIVOT and LISTPIVOTS
// expect: ok refusals: an aggregate, a field, the edge of the sheet, a pivot not there
// expect: ok it moves with inserted rows
// expect: ok saved, and read back
// expect: ok pivot.delete forgets it; its cells stay
