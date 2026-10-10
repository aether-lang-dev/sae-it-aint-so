// site/clip.ts -- a clip path on a live scene: vg.clip_path in vg.defs, and
// vg.clip(id) in a shape's block. A red square clipped to a circle.
// tests/spec_keys.ae reads it back.
const { text, btn } = ui;
text("Clip");
vg.scene("0 0 100 100", 200, 200, () => {
  vg.defs(() => vg.clip_path("disc", [["circle", 50, 50, 30]]));
  vg.rect(0, 0, 100, 100, () => vg.fill("#ffffff"));
  vg.rect(10, 10, 80, 80, () => { vg.fill("#ff0000"); vg.clip("disc"); });
});
btn("Home", () => browserContext.changePage("/"));
