// Charts of the selection, drawn in vg from the shapes charts.ts lays out
// (bar, line, pie: each its own scene, redrawn as its cells change), each
// with a button to delete it; and a sparkline of the selection, as text in
// the cell to its right.
import { keyOf } from "../address.ts";
import type { Shape } from "../charts.ts";
import { CHART_H, CHART_W } from "../workbook.ts";
import type { ChartView } from "../workbook.ts";
import type { SheetView } from "./view.ts";

function draw(s: Shape): void {
  switch (s.kind) {
    case "rect": vg.rect(s.x, s.y, s.w, s.h, () => vg.fill(s.fill)); return;
    case "line": vg.line(s.x1, s.y1, s.x2, s.y2, () => vg.stroke(s.stroke, s.width)); return;
    case "polyline": vg.polyline([...s.points], () => { vg.fill("none"); vg.stroke(s.stroke, s.width); vg.linejoin("round"); }); return;
    case "circle": vg.circle(s.cx, s.cy, s.r, () => vg.fill(s.fill)); return;
    case "path": vg.path(s.d, () => { vg.fill(s.fill); vg.stroke(s.stroke, 1); }); return;
    case "text": vg.text_anchored(s.x, s.y, s.size, s.anchor, s.text, () => vg.fill(s.fill)); return;
  }
}

export function chartPanel(v: SheetView): void {
  const insert = (kind: string) => () => v.run("chart.insert", { kind, range: v.range() });
  ui.hstack(() => {
    ui.btn("Bar chart", insert("bar"));
    ui.btn("Line chart", insert("line"));
    ui.btn("Pie chart", insert("pie"));
    ui.btn("Sparkline", () => {
      const s = v.selection();
      if (!s) return;
      const right = Math.max(s[0].col, s[1].col) + 1, top = Math.min(s[0].row, s[1].row);
      return v.run("insert.sparkline", { range: v.range(), at: keyOf({ col: right, row: top }) });
    });
  });
  each(v.charts, (c: ChartView & { n: number }) => `${c.n}`, (c: ChartView & { n: number }) => {
    ui.hstack(() => {
      ui.text(`${c.title}: ${c.kind} chart of ${c.range}`);
      ui.btn(`Delete chart ${c.n}`, () => v.run("chart.delete", { index: String(c.n) }));
    });
    vg.scene(`0 0 ${CHART_W} ${CHART_H}`, CHART_W, CHART_H, () => {
      vg.rect(0, 0, CHART_W, CHART_H, () => vg.fill("#ffffff"));
      c.shapes.forEach(draw);
    });
  });
}
