// SPDX-License-Identifier: MIT
// Charts, as a sae app. Ported from Tsyne's phone-apps/bar-chart,
// line-chart-demo and heatmap-demo (MIT, Copyright (c) 2025 Paul Hammant; see
// NOTICE.md), three small data-visualisation demos, here as three views of
// one app: six animated bars, a line chart with four interpolations, three
// series and zoom and pan, and an 8 by 8 heat map. The animations run on one
// time state that a timer advances in fixed steps, so Pause holds a moment
// and Restart goes back to it.
import { linear } from "sae:scales";
import { BAR_COLORS, BAR_LABELS, barValue, barMax, heatValue, viridis, rgbCss, DATA1, DATA2, DATA3, INTERPOLATIONS, linePath, zoomed, panned } from "./lib/charts.ts";
import type { Interpolation, ZoomPan } from "./lib/charts.ts";

const { vstack, hstack, text, btn, divider, toggle, state, bind, set_text, timer, clear, into } = ui;
const { scene, g, rect, line, path, text_anchored, fill, stroke, on_scroll, on_drag } = vg;

const t = state(0);                       // seconds
let running = true;
let shift = 0;                            // Randomize
const info = state("");
let pauseBtn = 0;
let holder = 0;

// --- bars: 400 x 250, six bars with their values above ---
const barsView = (): void => {
  const pad = 40, cw = 400 - pad * 2, ch = 250 - pad * 2, bw = cw / 6 - 10;
  const max = () => barMax(BAR_LABELS.map((_, i) => barValue(i, t.value, shift)));
  scene("0 0 400 250", 400, 250, () => {
    rect(0, 0, 400, 250, () => { fill("#ffffff"); stroke("#cccccc", 1); });
    line(pad, pad, pad, 250 - pad, () => stroke("#333333", 2));
    line(pad, 250 - pad, 400 - pad, 250 - pad, () => stroke("#333333", 2));
    for (let i = 1; i < 5; i++) line(pad, pad + (ch / 5) * i, 400 - pad, pad + (ch / 5) * i, () => stroke("#f0f0f0", 1));
    for (let i = 0; i < 6; i++) {
      const h = () => (barValue(i, t.value, shift) / max()) * ch;
      rect(pad + i * (bw + 10), 250 - pad - 1, bw, 1, () => {
        fill(BAR_COLORS[i]); stroke("#333333", 1);
        vg.bind_pos(() => ({ y: 250 - pad - h(), h: h() }));
      });
      text_anchored(pad + i * (bw + 10) + bw / 2, 30, 11, "middle", "", () => {
        fill("#333333");
        vg.bind_text(() => barValue(i, t.value, shift).toFixed(0));
        vg.bind_pos(() => ({ y: 250 - pad - h() - 4 }));
      });
    }
  });
};

// --- heat map: 8 x 8 cells of 40 px ---
const heatView = (): void => {
  scene("0 0 350 360", 350, 360, () => {
    rect(0, 0, 350, 360, () => { fill("#ffffff"); stroke("#cccccc", 1); });
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      rect(10 + c * 40, 10 + r * 40, 39, 39, () => {
        stroke("#ffffff", 0.5);
        vg.bind_fill(() => rgbCss(viridis(heatValue(r, c, t.value))));
      });
    }
    text_anchored(10, 338, 12, "start", "0 (low)", () => fill("#666666"));
    text_anchored(220, 338, 12, "start", "100 (high)", () => fill("#666666"));
  });
};

// --- lines: 640 x 360 plot in a 760 x 480 scene ---
let interp: Interpolation = "linear";
let multiple = false;
let zp: ZoomPan = { scale: 1, tx: 0, ty: 0 };
const zoomState = state(zp);
let chartG = 0;
let seriesG = 0;
const PW = 640, PH = 360;
const xs = linear([0, 100], [0, PW]);
const ys = linear([0, 100], [PH, 0]);
const pts = (d: { x: number; y: number }[]) => d.map((p) => ({ x: xs(p.x), y: ys(p.y) }));

const drawSeries = (): void => {
  if (seriesG) vg.remove(seriesG);
  vg.into(chartG, () => {
    seriesG = g(() => {
      const draw = (d: { x: number; y: number }[], color: string, w: number) => {
        path(linePath(pts(d), interp), () => { fill("none"); stroke(color, w); vg.linejoin("round"); });
      };
      if (multiple) { draw(DATA1, "#FF6B6B", 2); draw(DATA2, "#4ECDC4", 2); draw(DATA3, "#45B7D1", 2); }
      else {
        draw(DATA1, "#4ECDC4", 3);
        for (const p of pts(DATA1)) vg.circle(p.x, p.y, 4, () => fill("#FF6B6B"));
      }
    });
  });
};
const setZoom = (z: ZoomPan): void => { zp = z; zoomState.set(z); info.set(describeLines()); };
const describeLines = (): string => `Interpolation: ${interp} | Zoom: ${Math.round(zp.scale * 100)}%`;

const linesView = (): void => {
  scene("0 0 760 480", 760, 480, () => {
    rect(0, 0, 760, 480, () => {
      fill("#ffffff");
      on_scroll((_dx: number, dy: number) => setZoom(zoomed(zp, -dy)));
      on_drag((_x: number, _y: number, dx: number, dy: number) => setZoom(panned(zp, dx, dy)));
    });
    chartG = g(() => {
      vg.bind_transform(() => `translate(${60 + zoomState.value.tx} ${60 + zoomState.value.ty}) scale(${zoomState.value.scale})`);
      for (const tk of ys.ticks(5)) {
        line(0, ys(tk), PW, ys(tk), () => stroke("#f0f0f0", 1));
        text_anchored(-6, ys(tk) + 4, 11, "end", String(tk), () => fill("#333333"));
      }
      for (const tk of xs.ticks(5)) text_anchored(xs(tk), PH + 16, 11, "middle", String(tk), () => fill("#333333"));
      line(0, PH, PW, PH, () => stroke("#333333", 1));
      line(0, 0, 0, PH, () => stroke("#333333", 1));
    });
    text_anchored(380, 20, 14, "middle", "Time Series Data", () => fill("#333333"));
    text_anchored(60, 440, 11, "start", "Use the mouse wheel to zoom, drag to pan", () => fill("#999999"));
    drawSeries();
  });
};

// One view is built at a time (the others are not kept), so what is on screen
// is what a driver reads.
const show = (name: string): void => {
  clear(holder);
  into(holder, () => {
    if (name === "Bars") {
      hstack(4, () => { btn("Randomize", () => { shift = Math.random() * Math.PI * 2; t.set(t.value); }); });
      barsView();
    } else if (name === "Lines") {
      hstack(4, () => {
        for (const k of INTERPOLATIONS) btn(k, () => { interp = k; drawSeries(); info.set(describeLines()); });
        toggle("Show multiple series", (on: number) => { multiple = on === 1; drawSeries(); });
      });
      hstack(4, () => {
        btn("Zoom In", () => setZoom(zoomed(zp, 1)));
        btn("Zoom Out", () => setZoom(zoomed(zp, -1)));
        btn("Reset Zoom", () => setZoom({ scale: 1, tx: 0, ty: 0 }));
      });
      linesView();
    } else {
      heatView();
    }
  });
  info.set(name === "Lines" ? describeLines() : name === "Bars" ? "Animated bars" : "Temperature/value distribution over time");
};

hstack(4, () => {
  for (const name of ["Bars", "Lines", "Heatmap"]) btn(name, () => show(name));
  pauseBtn = btn("Pause", () => { running = !running; set_text(pauseBtn, running ? "Pause" : "Resume"); });
  btn("Restart", () => { t.set(0); });
});
bind(text(""), info);
divider();
holder = vstack(6);

timer(50, () => { if (running) t.set(t.value + 0.05); });
show("Bars");
