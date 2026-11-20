// SPDX-License-Identifier: BSD-3-Clause
// Fractal explorer, as a sae app. Ported from Tsyne's phone-apps/mandelbrot,
// julia-set, newton-fractal, tricorn and burning-ship (BSD-3-Clause,
// Copyright (c) 2025 Paul Hammant; see NOTICE.md), five apps that differ in
// one function and a start view, here one app with a picker. Zoom, pan, tap to
// zoom in on a point, eight palettes, Julia's six presets. The image is a
// vg.raster the page fills a few rows at a time on the frame clock, so the
// window answers while a deep zoom draws.
import { palettes, paletteNames } from "./lib/fractal-utils.ts";
import { KINDS, PRESETS, View, pointAt, tapZoom, scrollZoom, zoomIn, zoomOut, pan } from "./lib/views.ts";

const { hstack, vstack, text, btn, picker, picker_add, divider, state, bind, on_key, set_visible } = ui;
const { scene, on_click, on_scroll } = vg;

const W = 200, H = 200;
const ROWS_PER_FRAME = 10;

let kindIx = 0;
let paletteIx = 0;
let presetIx = 0;
let view: View = { centerX: KINDS[0].centerX, centerY: KINDS[0].centerY, zoom: KINDS[0].zoom };
const pixels = new Uint8Array(W * H * 4);
let raster = 0;
let nextRow = H;            // rows below this are drawn; H means done
let token = 0;              // a newer render cancels an older
const status = state("");
let presetBtn = 0;

const describe = (): string => {
  const pal = paletteNames[paletteIx];
  if (kindIx === 1) {
    const p = PRESETS[presetIx];
    return `c=(${p.cr.toFixed(3)}, ${p.ci.toFixed(3)}) | ${p.name} | ${pal}`;
  }
  return `Zoom: ${view.zoom.toFixed(1)}x | Center: (${view.centerX.toFixed(4)}, ${view.centerY.toFixed(4)}) | Palette: ${pal}`;
};

const renderRows = (mine: number): void => {
  if (mine !== token) return;
  const kind = KINDS[kindIx];
  const palette = palettes[paletteNames[paletteIx]];
  const p = PRESETS[presetIx];
  const stop = Math.min(H, nextRow + ROWS_PER_FRAME);
  for (let py = nextRow; py < stop; py++) {
    for (let px = 0; px < W; px++) {
      const [cx, cy] = pointAt(view, W, H, px, py);
      const [r, g, b, a] = palette(kind.iterate(cx, cy, kind.maxIter, p.cr, p.ci), kind.maxIter);
      const i = (py * W + px) * 4;
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = a;
    }
  }
  nextRow = stop;
  vg.raster_update(raster, pixels);
  if (nextRow < H) ui.frame(() => renderRows(mine));
  else print(`fractals: drew ${kind.name} ${describe()}`);
};

const render = (): void => {
  token++;
  nextRow = 0;
  status.set(describe());
  const mine = token;
  ui.frame(() => renderRows(mine));
};

const go = (v: View): void => { view = v; render(); };
const reset = (): void => {
  const k = KINDS[kindIx];
  view = { centerX: k.centerX, centerY: k.centerY, zoom: k.zoom };
  render();
};

hstack(4) {
  const pick = picker((i: number) => { kindIx = i; set_visible(presetBtn, i === 1); reset(); });
  for (const k of KINDS) picker_add(pick, k.name);
  btn("Zoom In", () => go(zoomIn(view)));
  btn("Zoom Out", () => go(zoomOut(view)));
  btn("Reset", reset);
}
hstack(4) {
  btn("Left", () => go(pan(view, W, H, -1, 0)));
  btn("Up", () => go(pan(view, W, H, 0, -1)));
  btn("Down", () => go(pan(view, W, H, 0, 1)));
  btn("Right", () => go(pan(view, W, H, 1, 0)));
}
hstack(4) {
  btn("Next Palette", () => { paletteIx = (paletteIx + 1) % paletteNames.length; render(); });
  presetBtn = btn("Next Preset", () => { presetIx = (presetIx + 1) % PRESETS.length; render(); });
}
set_visible(presetBtn, false);
divider();
scene(`0 0 ${W} ${H}`, W, H) {
  raster = vg.raster(W, H, pixels) {
    on_click((x: number, y: number) => go(tapZoom(view, W, H, x, y)));
    on_scroll((dx: number, dy: number) => go(scrollZoom(view, W, H, W / 2, H / 2, -dy)));
  };
}
bind(text(""), status);

on_key((key: string) => {
  if (key === "Left") go(pan(view, W, H, -1, 0));
  else if (key === "Right") go(pan(view, W, H, 1, 0));
  else if (key === "Up") go(pan(view, W, H, 0, -1));
  else if (key === "Down") go(pan(view, W, H, 0, 1));
  else if (key === "plus" || key === "+" || key === "=") go(zoomIn(view));
  else if (key === "minus" || key === "-") go(zoomOut(view));
});

render();
