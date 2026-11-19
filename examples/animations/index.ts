// SPDX-License-Identifier: MIT
// Animations, as a sae app. Ported from Tsyne's phone-apps/spinner,
// fractal-tree and particles (MIT, Copyright (c) 2025 Paul Hammant; see
// NOTICE.md): an eight-wedge loading spinner whose alpha sweeps round, a
// five-level fractal tree that grows for three seconds and sways, and a
// particle fountain with gravity, air resistance and fading that bursts where
// you click. One time advances in fixed steps, so Pause holds a moment, Step
// moves half a second on and Restart goes back to the start.
import { SPINNER_COLORS, segmentAlpha, tree, growthPhase, swayAngle, ParticleSystem } from "./lib/animations.ts";
import type { Particle } from "./lib/animations.ts";

const { vstack, hstack, text, btn, divider, state, bind, set_text, timer, clear, into } = ui;
const { scene, g, rect, circle, line, path, fill, stroke, linecap, on_click, transform } = vg;

const DT = 0.016;
const t = state(0);
let running = true;
let pauseBtn = 0;
let holder = 0;
let view = "Spinner";
const info = state("");
const count = state("");
let sim = new ParticleSystem(1);
const parts = state<Particle[]>(sim.particles);

// --- spinner: eight wedges of 45 degrees, radius 60, round (150, 150) ---
const spinnerView = (): void => {
  scene("0 0 300 300", 300, 300, () => {
    rect(0, 0, 300, 300, () => { fill("#ffffff"); stroke("#eeeeee", 1); });
    circle(150, 150, 80, () => { fill("none"); stroke("#e0e0e0", 2); });
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      path(`M150 150 L${150 + 60 * Math.cos(a0)} ${150 + 60 * Math.sin(a0)} A60 60 0 0 1 ${150 + 60 * Math.cos(a1)} ${150 + 60 * Math.sin(a1)} Z`, () => {
        fill(SPINNER_COLORS[i]);
        vg.bind_opacity(() => segmentAlpha(i, t.value));
      });
    }
    circle(150, 150, 20, () => { fill("#ffffff"); stroke("#cccccc", 1); });
  });
};

// --- tree: 400 x 500 ---
let treeG = 0;
let treeDrawn = -1;
const drawTree = (): void => {
  const growth = growthPhase(t.value);
  const key = Math.round(growth * 100);
  if (key === treeDrawn) return;
  treeDrawn = key;
  if (treeG) vg.remove(treeG);
  const { branches, leaves } = tree(growth);
  vg.into(swayG, () => {
    treeG = g(() => {
      for (const b of branches) line(b.x1, b.y1, b.x2, b.y2, () => { stroke("#8B4513", b.thickness); linecap("round"); });
      for (const l of leaves) circle(l.x, l.y, 4, () => fill("#228B22"));
    });
  });
};
let swayG = 0;
const treeView = (): void => {
  treeDrawn = -1;
  treeG = 0;
  scene("0 0 400 500", 400, 500, () => {
    rect(0, 0, 400, 500, () => { fill("#87CEEB"); stroke("#6BA5D1", 1); });
    rect(0, 400, 400, 100, () => fill("#90EE90"));
    swayG = g(() => { vg.bind_transform(() => `rotate(${(swayAngle(t.value) * 180) / Math.PI} 200 400)`); });
    drawTree();
  });
};

// --- particles: 400 x 400; the circles are one data join over the list ---
const particlesView = (): void => {
  scene("0 0 400 400", 400, 400, () => {
    rect(0, 0, 400, 400, () => {
      fill("#1a1a2e"); stroke("#16213e", 1);
      on_click((x: number, y: number) => { sim.burst(x, y, 30); parts.set(sim.particles); count.set(`Particles: ${sim.particles.length}`); });
    });
    circle(200, 250, 5, () => { fill("#ffffff"); stroke("#ffff00", 2); });
    g(() => {
      vg.items(parts, "id",
        (p: Particle) => circle(p.x, p.y, p.radius, () => { fill(p.color); vg.opacity(Math.max(0, p.lifetime)); }),
        (p: Particle, h: number) => vg.set(h, { cx: p.x, cy: p.y, opacity: Math.max(0, p.lifetime) }));
    });
  });
};

const show = (name: string): void => {
  view = name;
  clear(holder);
  into(holder, () => { if (name === "Spinner") spinnerView(); else if (name === "Tree") treeView(); else particlesView(); });
  info.set(name === "Spinner" ? "Loading..." : name === "Tree" ? "Fractal tree grows recursively" : "Click to burst. Physics: gravity & air resistance");
  count.set(name === "Particles" ? `Particles: ${sim.particles.length}` : "");
};

// n steps of 16 ms; the state is set once at the end, so the bindings run
// once however many steps were taken (a Step is 31 of them)
const advance = (n: number): void => {
  for (let i = 0; i < n; i++) sim.update(DT);
  t.set(t.value + n * DT);
  if (view === "Particles") { parts.set(sim.particles); count.set(`Particles: ${sim.particles.length}`); }
  if (view === "Tree") drawTree();
};

hstack(4, () => {
  for (const name of ["Spinner", "Tree", "Particles"]) btn(name, () => show(name));
  pauseBtn = btn("Pause", () => { running = !running; set_text(pauseBtn, running ? "Pause" : "Resume"); });
  btn("Step", () => advance(31));
  btn("Restart", () => { t.set(0); sim = new ParticleSystem(1); parts.set(sim.particles); treeDrawn = -1; if (view === "Tree") drawTree(); count.set(view === "Particles" ? `Particles: ${sim.particles.length}` : ""); });
});
bind(text(""), info);
bind(text(""), count);
divider();
holder = vstack(6);

timer(16, () => { if (running) advance(1); });
show("Spinner");
