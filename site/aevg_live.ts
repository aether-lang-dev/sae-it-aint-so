// AeVG alive: bindings to page state, a data join, tweens on the frame
// clock, events beyond click, and the viewBox as state (zoom and pan).
const { text, btn } = ui;
const { scene, g, rect, circle, line, text_sized, fill, stroke, on_hover, on_drag, on_scroll,
        on_double_click, tooltip, cursor, bind_fill, bind_text, bind_pos, visible_when } = vg;

interface Bar { id: number; h: number }

const hot = state(false);
const label = state("idle");
const x = state(20);
const bars = state<Bar[]>([{ id: 1, h: 10 }, { id: 2, h: 20 }]);
const view = state("0 0 100 100");
let ball = 0, rotor = 0, sceneH = 0;

text("AeVG alive");
sceneH = scene("0 0 100 100", 300, 300, () => {
  vg.view_box(view);                         // zoom and pan: the viewBox follows a state
  rect(0, 0, 100, 100, () => fill("#ffffff"));
  rect(5, 5, 20, 20, () => {                 // bound fill: follows `hot`
    bind_fill(() => (hot.value ? "#ff0000" : "#0000ff"));
    tooltip("A bound square");
    cursor("pointer");
    on_hover((inside: boolean) => print(`hover ${inside ? "in" : "out"}`));
    on_double_click((px: number, py: number) => print(`double at ${Math.round(px)},${Math.round(py)}`));
  });
  circle(60, 15, 6, () => {                  // a shape shown while a state holds
    fill("#008800");
    visible_when(() => hot.value);
  });
  circle(20, 45, 6, () => {                  // bound position: cx follows `x`
    fill("#aa00aa");
    bind_pos(() => ({ cx: x.value }));
    on_drag((px: number, py: number, dx: number, dy: number) => x.set(px));
    on_scroll((dx: number, dy: number) => print(`scroll ${dy < 0 ? "in" : "out"}`));
  });
  text_sized(5, 70, 8, "idle", () => { fill("#000000"); bind_text(() => label.value); });
  g(() => {                                  // a data join: one bar per item, keyed
    vg.items(bars, "id", (b: Bar, i: number) => rect(50 + i * 12, 100 - b.h - 5, 8, b.h, () => fill("#ff8800")),
      (b: Bar, h: number) => vg.set(h, { h: b.h, y: 100 - b.h - 5 }));
  });
  ball = circle(80, 50, 8, () => fill("#ff0000"));
  rotor = g(() => { rect(70, 75, 20, 4, () => fill("#444444")); });
});
btn("Heat", () => { hot.set(!hot.value); label.set(hot.value ? "hot" : "idle"); });
btn("Move right", () => x.set(x.value + 20));
btn("Add bar", () => bars.update((bs) => [...bs, { id: bs.length + 1, h: 30 }]));
btn("Grow bars", () => bars.update((bs) => bs.map((b) => ({ ...b, h: b.h + 10 }))));
btn("Drop bar", () => bars.update((bs) => bs.slice(0, -1)));
btn("Tween ball", () => vg.animate(ball, { to: { fill: "#00ff00", cx: 50 }, ms: 150 }, () => print("tween done")));
btn("Spin rotor", () => vg.animate(rotor, { to: { rotate: 90 }, center: [80, 77], ms: 150 }));
btn("Zoom", () => view.set(view.value === "0 0 100 100" ? "25 25 50 50" : "0 0 100 100"));
btn("Home", () => browserContext.changePage("/"));
