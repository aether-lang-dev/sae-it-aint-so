// SPDX-License-Identifier: MIT
// Dashboards, as a sae app. Ported from Tsyne's phone-apps/gauge-dashboard and
// dial-dashboard (MIT, Copyright (c) 2025 Paul Hammant; see NOTICE.md): thirteen
// gauges (system metrics, five arc orientations, four sizes) animated from one
// time state, and twelve dials in four styles and several angle ranges that
// turn when clicked or dragged. Tsyne draws both with Cosyne primitives; here
// they are vg arcs and lines (lib/dashboards.ts has the geometry).
import { SYSTEM, ORIENTATION, SIZES, DIALS, STYLES, gaugeSweep, arcD, polar, dialStart, dialEnd, dialAngle, dialValueAt, dialText, dialFraction } from "./lib/dashboards.ts";
import type { GaugeSpec, DialSpec } from "./lib/dashboards.ts";

const { vstack, hstack, text, btn, divider, state, bind, set_text, timer, clear, into } = ui;
const { scene, g, rect, circle, line, path, text_anchored, fill, stroke, linecap, on_click, on_drag, transform } = vg;

const t = state(0);                // seconds, advanced in fixed steps
let running = true;
let pauseBtn = 0;
let holder = 0;
const info = state("");

// ---------- gauges ----------

let viewGen = 0;   // each view built is a generation; an older one's subscriptions do nothing

const gaugeAt = (spec: GaugeSpec, cx: number, cy: number, labelY: number, valueY: number): void => {
  const r = spec.radius ?? 35;
  const start = spec.start ?? 225, sweep = gaugeSweep(start, spec.end ?? 315);
  text_anchored(cx, labelY, 12, "middle", spec.label) { fill("#333333") }
  path(arcD(cx, cy, r, start, sweep, true)) { fill("none"); stroke("#e0e0e0", 8); linecap("round") }
  const frac = () => Math.max(0, Math.min(1, spec.value(t.value) / 100));
  // the value's arc is drawn again when the value moves a whole percent
  let arc = 0;
  let shown = -1;
  const gen = viewGen;
  const draw = () => {
    if (gen !== viewGen) return;
    const pct = Math.round(frac() * 100);
    if (pct === shown) return;
    shown = pct;
    if (arc) vg.remove(arc);
    vg.into(group) { arc = path(arcD(cx, cy, r, start, Math.max(0.01, sweep * pct / 100), true)) { fill("none"); stroke(spec.color, 8); linecap("round") } }
  };
  const group = g {};
  draw();
  t.subscribe(draw);
  text_anchored(cx, valueY, 12, "middle", "0%") { fill("#333333"); vg.bind_text(() => `${Math.round(spec.value(t.value))}%`) }
};

const gaugesView = (): void => {
  scene("0 0 520 440", 520, 440) {
    rect(0, 0, 520, 440) { fill("#ffffff") }
    text_anchored(10, 16, 14, "start", "System Metrics") { fill("#333333") }
    SYSTEM.forEach((s, i) => gaugeAt(s, 65 + i * 130, 75, 36, 128));
    text_anchored(10, 156, 14, "start", "Arc Orientations") { fill("#333333") }
    ORIENTATION.forEach((s, i) => gaugeAt(s, 52 + i * 104, 215, 176, 262));
    text_anchored(10, 292, 14, "start", "Size & Style Variations") { fill("#333333") }
    SIZES.forEach((s, i) => gaugeAt(s, 65 + i * 130, 360, 316, 424));
  }
};

// ---------- dials ----------

const values: { [id: string]: number } = {};
const vals = state(0);                // bumps when a dial moves
let dialRedraw: { [id: string]: () => void } = {};

const footer = state("");
const updateFooter = (): void => { footer.set(`Vol: ${values["volume"]}%  Temp: ${values["temp"].toFixed(1)}°  Pan: ${values["pan"]}  Speed: ${values["speed"]}`); };

const dialAt = (d: DialSpec): void => {
  const st = STYLES[d.style ?? "classic"];
  const accent = d.accent ?? st.accent, track = d.track ?? st.track, knob = d.knob ?? st.knob, indicator = d.indicator ?? st.indicator, textColor = d.text ?? st.text;
  const start = dialStart(d), sweep = dialEnd(d) - dialStart(d);
  const ar = d.radius;
  text_anchored(d.x, d.y - d.radius - 22, 12, "middle", d.label) { fill(d.style === "modern" ? "#ffffff" : "#333333") }
  g {
    path(arcD(d.x, d.y, ar, start, sweep, false)) { fill("none"); stroke(track, 6); linecap("round") }
    if (d.ticks) {
      for (let i = 0; i < d.ticks; i++) {
        const a = start + (sweep * i) / Math.max(1, d.ticks - (sweep >= 360 ? 0 : 1));
        const major = d.majorEvery ? i % d.majorEvery === 0 : i === 0 || i === d.ticks - 1;
        const [x1, y1] = polar(d.x, d.y, ar + 6, a, false), [x2, y2] = polar(d.x, d.y, ar + (major ? 12 : 9), a, false);
        line(x1, y1, x2, y2) { stroke(textColor, major ? 2 : 1) }
      }
    }
  }
  circle(d.x, d.y, ar * 0.62) { fill(knob); stroke(track, 1) }
  // the part that moves: the value's arc and the indicator
  let arc = 0;
  let ind = 0;
  const motion = g {};
  const draw = (): void => {
    const v = values[d.id];
    if (arc) vg.remove(arc);
    if (ind) vg.remove(ind);
    const fr = dialFraction(d, v);
    vg.into(motion) {
      arc = path(arcD(d.x, d.y, ar, start, Math.max(0.01, sweep * fr), false)) { fill("none"); stroke(accent, 6); linecap("round") };
      const [ix, iy] = polar(d.x, d.y, ar * 0.62 - 3, dialAngle(d, v), false);
      ind = line(d.x, d.y, ix, iy) { stroke(indicator, 3); linecap("round") };
    }
    set_valueText(dialText(d, v));
  };
  let valueNode = 0;
  const set_valueText = (s: string): void => { if (valueNode) vg.set_text(valueNode, s); };
  if (d.showValue !== false) valueNode = text_anchored(d.x, d.y + 4, Math.max(9, ar * 0.3), "middle", dialText(d, values[d.id])) { fill(textColor) };
  // a click or drag anywhere on the dial sets the value from where the pointer is
  const set = (x: number, y: number): void => {
    values[d.id] = dialValueAt(d, x, y);
    draw();
    updateFooter();
  };
  circle(d.x, d.y, ar + 14) {
    fill("#000000"); vg.opacity(0.001);
    on_click((x: number, y: number) => set(x, y));
    on_drag((x: number, y: number) => set(x, y));
  }
  dialRedraw[d.id] = draw;
  draw();
};

const dialsView = (): void => {
  dialRedraw = {};
  for (const d of DIALS) if (values[d.id] === undefined) values[d.id] = d.value;
  updateFooter();
  scene("0 0 520 480", 520, 480) {
    rect(0, 0, 520, 480) { fill("#f5f5f5") }
    rect(365, 30, 110, 110) { fill("#1a1a1a") }
    for (const d of DIALS) dialAt(d);
  }
  hstack(4) { bind(text(""), footer) }
};

// the bound dial follows the clock
const followClock = (): void => {
  const d = DIALS[DIALS.length - 1];
  const v = Math.round((Math.sin(t.value) * 50 + 50) * 10) / 10;
  if (values[d.id] !== v) { values[d.id] = v; if (dialRedraw[d.id]) dialRedraw[d.id](); }
};

let view = "Gauges";
const show = (name: string): void => {
  view = name;
  viewGen++;
  clear(holder);
  into(holder) { if (name === "Gauges") gaugesView(); else dialsView() }
  info.set(name === "Gauges" ? "System metrics, arc orientations, sizes" : "Drag or click a dial to turn it");
};

hstack(4) {
  btn("Gauges", () => show("Gauges"));
  btn("Dials", () => show("Dials"));
  pauseBtn = btn("Pause", () => { running = !running; set_text(pauseBtn, running ? "Pause" : "Resume"); });
  btn("Restart", () => { t.set(0); });
}
bind(text(""), info);
divider();
holder = vstack(6);

timer(33) { if (running) { t.set(t.value + 0.033); if (view === "Dials") followClock(); } }
show("Gauges");
