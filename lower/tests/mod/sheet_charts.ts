// Charts and sparklines. site/sheet/charts.ts lays a chart out with no
// toolkit, as GridCraft's chart crate does: a range read as categories and
// series, a scale with round ticks, and bar, line and pie charts as plain
// shapes (rects, lines, polylines, circles, paths, text) that the page draws
// in vg. A sparkline is text in a cell (SPARKLINE(B2:B9) in Excel formulas,
// SPARKLINE_RANGE("B2:B9") in RexxJS ones). Then the chart.* commands.
import { chartData, layout, niceScale, sparkline, PALETTE } from "./sheet/charts.ts";
import type { Shape } from "./sheet/charts.ts";
import { parseRange } from "./sheet/address.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { writeSheetFile } from "./sheet/file.ts";
import { show } from "./sheet/format.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const cells: Record<string, Value> = { B1: "North", C1: "South", A2: "Q1", A3: "Q2", A4: "Q3", B2: 10, B3: 20, B4: 40, C2: 30, C3: "n/a", C4: 10 };
const value = (k: string) => cells[k] ?? null;
const data = chartData(parseRange("A1:C4")!, value);
eq("a range read as Excel reads it: text down the first column names the categories, across the first row the series",
  data, { labels: ["Q1", "Q2", "Q3"], series: [{ name: "North", values: [10, 20, 40] }, { name: "South", values: [30, 0, 10] }] });
eq("numbers alone: categories counted, one series a column", chartData(parseRange("B2:B4")!, value), { labels: ["1", "2", "3"], series: [{ name: "Series 1", values: [10, 20, 40] }] });
eq("a scale with round ticks, from zero, or from below it", [niceScale(0, 87), niceScale(-15, 40), niceScale(0, 0), niceScale(0, 4)],
  [{ lo: 0, hi: 100, step: 20 }, { lo: -20, hi: 40, step: 20 }, { lo: 0, hi: 1, step: 0.2 }, { lo: 0, hi: 4, step: 1 }]);

const of = <K extends Shape["kind"]>(shapes: Shape[], kind: K) => shapes.filter((s): s is Extract<Shape, { kind: K }> => s.kind === kind);
const texts = (shapes: Shape[]) => of(shapes, "text").map((t) => t.text);

const bar = layout("bar", data, "Sales", 400, 240);
const bars = of(bar, "rect").filter((r) => r.w > 10);
eq("a bar chart: a bar per value, by category then series, in the palette", bars.map((r) => r.fill), [PALETTE[0], PALETTE[1], PALETTE[0], PALETTE[1], PALETTE[0], PALETTE[1]]);
const round = (n: number) => Math.round(n * 1000) / 1000;
eq("heights in proportion, on one baseline", [round(bars[4].h / bars[0].h), round(bars[2].h / bars[0].h), new Set(bars.filter((r) => r.h > 0).map((r) => round(r.y + r.h))).size], [4, 2, 1]);
eq("its title, ticks, categories and legend", texts(bar), ["Sales", "0", "10", "20", "30", "40", "Q1", "Q2", "Q3", "North", "South"]);
const line = layout("line", data, "", 400, 240);
eq("a line chart: a line and markers a series", [of(line, "polyline").map((p) => [p.stroke, p.points.length]), of(line, "circle").length], [[[PALETTE[0], 6], [PALETTE[1], 6]], 6]);
eq("its points rise with the values", (() => {
  const ys = of(line, "polyline")[0].points.filter((_, i) => i % 2 === 1);
  return ys[0] > ys[1] && ys[1] > ys[2];
})(), true);
const pie = layout("pie", { labels: ["A", "B", "C"], series: [{ name: "S", values: [50, 25, 25] }] }, "Share", 300, 240);
eq("a pie: a slice a category, the first series, from the top clockwise, with its share", [of(pie, "path").map((p) => p.fill), texts(pie)],
  [[PALETTE[0], PALETTE[1], PALETTE[2]], ["Share", "50%", "25%", "25%", "A", "B", "C"]]);
eq("the first slice is half the circle", of(pie, "path")[0].d.includes(" 0 0 1 "), true);

eq("a sparkline: eight heights of block", [sparkline([1, 2, 3, 4, 5, 6, 7, 8]), sparkline([5, 5]), sparkline([]), sparkline([0, 10, 5])], ["▁▂▃▄▅▆▇█", "▄▄", "", "▁█▅"]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
for (const [k, v] of Object.entries(cells)) await cmds.run(`cell.set cell=${k} input="${v}"`);
eq("chart.insert", [await message("chart.insert kind=bar range=A1:C4 title=Sales"), wb.charts().map((c) => [c.kind, c.title, c.range])],
  ["inserted a bar chart of A1:C4", [["bar", "Sales", "A1:C4"]]]);
eq("a chart's shapes follow its cells", [(await cmds.run("cell.set cell=B2 input=80")) && wb.charts()[0].data.series[0].values, wb.charts()[0].shapes.length > 10], [[80, 20, 40], true]);
await cmds.run("chart.insert kind=pie range=A2:B4");
eq("chart.list, with a title by default", (await cmds.run("chart.list")).output, ["1. Sales: bar chart of A1:C4", "2. Chart 2: pie chart of A2:B4"]);
await cmds.run("rows.insert at=1");
eq("rows inserted move what they chart", wb.charts().map((c) => c.range), ["A2:C5", "A3:B5"]);
eq("saved with the sheet", writeSheetFile(wb).charts, [{ kind: "bar", range: "A2:C5", title: "Sales" }, { kind: "pie", range: "A3:B5", title: "Chart 2" }]);
eq("chart.delete, and refusals", [await message("chart.delete index=2"), await message("chart.delete index=2"), await message("chart.insert kind=radar range=A1:B2")],
  ["deleted Chart 2", "no chart 2", "radar is not a chart (bar, line, pie)"]);
eq("insert.sparkline: a formula in a cell, in the sheet's language", [await message("insert.sparkline range=B3:B5 at=D3"), wb.sheet.input("D3"), show(wb.sheet.value("D3"))],
  ["D3 = █▁▃", "=SPARKLINE(B3:B5)", "█▁▃"]);
await cmds.run("formulas.use language=RexxJS");
eq("and in RexxJS's", [await message("insert.sparkline range=B3:B5 at=D4"), wb.sheet.input("D4")], ["D4 = █▁▃", '=SPARKLINE_RANGE("B3:B5")']);
// expect: ok a range read as Excel reads it: text down the first column names the categories, across the first row the series
// expect: ok numbers alone: categories counted, one series a column
// expect: ok a scale with round ticks, from zero, or from below it
// expect: ok a bar chart: a bar per value, by category then series, in the palette
// expect: ok heights in proportion, on one baseline
// expect: ok its title, ticks, categories and legend
// expect: ok a line chart: a line and markers a series
// expect: ok its points rise with the values
// expect: ok a pie: a slice a category, the first series, from the top clockwise, with its share
// expect: ok the first slice is half the circle
// expect: ok a sparkline: eight heights of block
// expect: ok chart.insert
// expect: ok a chart's shapes follow its cells
// expect: ok chart.list, with a title by default
// expect: ok rows inserted move what they chart
// expect: ok saved with the sheet
// expect: ok chart.delete, and refusals
// expect: ok insert.sparkline: a formula in a cell, in the sheet's language
// expect: ok and in RexxJS's
