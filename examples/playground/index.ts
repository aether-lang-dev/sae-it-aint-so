// SPDX-License-Identifier: MIT
// Playground, as a sae app. Ported from Tsyne's phone-apps/bouncing-ball and
// interactive-shapes (MIT, Copyright (c) 2025 Paul Hammant; see NOTICE.md),
// two Cosyne demos of a canvas that answers the pointer: three balls under
// gravity that can be picked up and flicked, and three shapes that change
// colour when clicked, light up under the pointer and move when dragged.
import { WIDTH, HEIGHT, newBalls, stepBall, release, pickRandom, newShapes } from "./lib/playground.ts";
import type { Ball, Shape } from "./lib/playground.ts";

const { hstack, text, btn, divider, state, bind, set_text, timer, clear, into, vstack } = ui;
const { scene, g, rect, circle, line, text_anchored, fill, stroke, on_click, on_drag, on_drag_end, on_hover } = vg;

let balls: Ball[] = newBalls();
let shapes: Shape[] = newShapes();
const tick = state(0);               // moves when anything has moved, so the bindings run
let running = true;
let view = "Balls";
let pauseBtn = 0;
let holder = 0;
const info = state("");
let hovered = "";

// --- balls ---
const ballsView = (): void => {
  scene(`0 0 ${WIDTH} ${HEIGHT}`, WIDTH, HEIGHT, () => {
    rect(0, 0, WIDTH, HEIGHT, () => fill("#F0F0F0"));
    rect(0, 0, WIDTH, 40, () => fill("#2C3E50"));
    text_anchored(250, 26, 14, "middle", "Bouncing Balls (drag a ball)", () => fill("#FFFFFF"));
    rect(0, HEIGHT - 10, WIDTH, 10, () => fill("#8B7355"));
    line(10, 10, 10, HEIGHT - 10, () => stroke("#8B7355", 2));
    line(WIDTH - 10, 10, WIDTH - 10, HEIGHT - 10, () => stroke("#8B7355", 2));
    balls.forEach((b, i) => {
      circle(b.x, b.y, b.radius, () => {
        fill(b.color); stroke("#FFFFFF", 2);
        vg.bind_pos(() => { tick.value; return { cx: balls[i].x, cy: balls[i].y }; });
        on_drag((x: number, y: number) => { const ball = balls[i]; ball.dragging = true; ball.vx = 0; ball.vy = 0; ball.x = x; ball.y = y; tick.set(tick.value + 1); });
        on_drag_end(() => { release(balls[i]); tick.set(tick.value + 1); });
      });
    });
  });
};

// --- shapes ---
const shapesView = (): void => {
  scene(`0 0 ${WIDTH} ${HEIGHT}`, WIDTH, HEIGHT, () => {
    rect(0, 0, WIDTH, HEIGHT, () => fill("#FFFFFF"));
    shapes.forEach((s, i) => {
      let grab: [number, number] | null = null;
      const common = () => {
        on_click(() => { shapes[i].color = pickRandom(shapes[i].color); tick.set(tick.value + 1); });
        on_hover((inside: number) => { hovered = inside ? shapes[i].id : (hovered === shapes[i].id ? "" : hovered); tick.set(tick.value + 1); });
        on_drag((x: number, y: number, dx: number, dy: number) => {
          if (!grab) grab = [shapes[i].x - (x - dx), shapes[i].y - (y - dy)];
          shapes[i].x = x + grab[0]; shapes[i].y = y + grab[1];
          tick.set(tick.value + 1);
        });
        on_drag_end(() => { grab = null; });
      };
      if (s.type === "circle") {
        // the highlight ring is under the circle, so the circle keeps the pointer
        circle(s.x, s.y, s.r! + 5, () => {
          fill("#000000"); vg.opacity(0.001);
          vg.bind_opacity(() => { tick.value; return hovered === shapes[i].id ? 0.25 : 0.001; });
          vg.bind_pos(() => { tick.value; return { cx: shapes[i].x, cy: shapes[i].y }; });
        });
        circle(s.x, s.y, s.r!, () => { fill(s.color); vg.bind_fill(() => { tick.value; return shapes[i].color; }); vg.bind_pos(() => { tick.value; return { cx: shapes[i].x, cy: shapes[i].y }; }); common(); });
      } else {
        rect(s.x, s.y, s.w!, s.h!, () => { fill(s.color); vg.bind_fill(() => { tick.value; return shapes[i].color; }); vg.bind_pos(() => { tick.value; return { x: shapes[i].x, y: shapes[i].y }; }); common(); });
      }
    });
  });
};

const show = (name: string): void => {
  view = name;
  clear(holder);
  into(holder, () => { if (name === "Balls") ballsView(); else shapesView(); });
  info.set(name === "Balls" ? "Drag a ball and let go to flick it" : "Click to change colour, drag to move, hover to highlight");
};

const advance = (n: number): void => {
  if (view !== "Balls") return;
  for (let k = 0; k < n; k++) balls.forEach(stepBall);
  tick.set(tick.value + 1);
};

hstack(4, () => {
  btn("Balls", () => show("Balls"));
  btn("Shapes", () => show("Shapes"));
  pauseBtn = btn("Pause", () => { running = !running; set_text(pauseBtn, running ? "Pause" : "Resume"); });
  btn("Step", () => advance(30));
  btn("Reset", () => { balls = newBalls(); shapes = newShapes(); tick.set(tick.value + 1); show(view); });
});
bind(text(""), info);
divider();
holder = vstack(6);
timer(30, () => { if (running) advance(1); });
show("Balls");
