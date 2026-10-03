// Vector graphics: AeVG (aether-ui's port of Tsyne's Cosyne CVG), with the
// same block-as-last-argument shape as `ui`. Coordinates are in the viewBox.
const { text, btn } = ui;

text("Vector graphics");
let clicks = 0;
let circle = 0;
vg.scene("0 0 100 100", 300, 300, () => {
  vg.rect(0, 0, 100, 100, () => vg.fill("#f4f4f4"));
  circle = vg.circle(30, 40, 18, () => {
    vg.fill("#cc4444");
    vg.on_click((x: number, y: number) => {
      clicks++;
      vg.set_fill(circle, "#33aa33");
      print(`circle clicked at ${Math.round(x)},${Math.round(y)}; ${clicks} so far`);
    });
  });
  vg.rect(58, 22, 34, 34, () => {
    vg.fill("#3366cc");
    vg.stroke("#003366", 1);
  });
  vg.line(10, 70, 90, 70, () => vg.stroke("#888888", 1));
  vg.path("M 10 95 L 30 75 L 50 95 Z", () => vg.fill("#e0a020"));
  vg.text(55, 90, "AeVG", () => vg.fill("#222222"));
});
btn("Blue circle", () => vg.set_fill(circle, "#3366cc"));
btn("Home", () => browserContext.changePage("/"));
