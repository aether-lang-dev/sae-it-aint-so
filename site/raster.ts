// Pixels from a page (docs/roadmap.md 8.2): vg.raster, vg.raster_update,
// vg.image, ui.image, and the budgets that refuse too much of them.
// tests/spec_raster.ae reads the pixels back and the console lines.
const { text, btn } = ui;

text("Rasters");

// A 2x2 RGBA8 buffer: red, green / blue, white.
const px = new Uint8Array([
  255, 0, 0, 255,   0, 255, 0, 255,
  0, 0, 255, 255,   255, 255, 255, 255,
]);
// quad.png: the same four pixels, encoded (aether-ui's examples/vg_image_demo/quad.png).
const quad = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,2,0,0,0,2,8,6,0,0,0,114,182,13,36,0,0,0,18,73,68,65,84,120,156,99,248,207,192,240,31,12,129,52,24,0,0,73,200,9,247,249,171,182,13,0,0,0,0,73,69,78,68,174,66,96,130]);

let raster = 0;
let picture = 0;
vg.scene("0 0 100 100", 300, 300, () => {
  vg.rect(0, 0, 100, 100, () => vg.fill("#ffffff"));
  raster = vg.raster(2, 2, px, () => {
    vg.box(0, 0, 50, 50);                       // stretched over the top-left quarter
    vg.on_click((x: number, y: number) => {
      for (let i = 0; i < 4; i++) px.set([255, 255, 0, 255], i * 4);     // yellow
      vg.raster_update(raster, px);
      print(`raster clicked at ${Math.floor(x)},${Math.floor(y)}`);
    });
  });
  picture = vg.image(quad, () => {
    vg.box(50, 50, 50, 50);                     // the decoded PNG, bottom-right quarter
    vg.fit("contain");
  });
});
const [pw, ph] = vg.raster_size(picture);
print(`image decoded as ${pw}x${ph}`);
ui.image(quad);                                  // the same picture as a widget

btn("Update", () => {
  px.set([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  vg.raster_update(raster, px);
  print("raster updated to black");
});

// Refusals: each prints the TypeError's message.
const refuse = (what: string, f: () => void) => {
  try { f(); print(`${what}: accepted`); }
  catch (e) { print(`${what}: ${(e as Error).message}`); }
};
btn("Refusals", () => {
  vg.scene("0 0 10 10", 10, 10, () => {
    refuse("too wide", () => vg.raster(4097, 1, new Uint8Array(4097 * 4)));
    refuse("short buffer", () => vg.raster(2, 2, new Uint8Array(15)));
    refuse("not bytes", () => vg.raster(2, 2, [1, 2, 3] as unknown as Uint8Array));
    refuse("not an image", () => vg.image(new Uint8Array([1, 2, 3, 4])));
    refuse("update wrong size", () => vg.raster_update(raster, new Uint8Array(8)));
    refuse("update a stranger", () => vg.raster_update(999, px));
    // 32 MB of pixels a page: three 8 MB rasters fit beside the small ones
    // above, a fourth (which would make 32 MB and 48 bytes) does not.
    const big = new Uint8Array(1024 * 2048 * 4);
    for (let i = 0; i < 3; i++) refuse(`big ${i}`, () => { vg.raster(1024, 2048, big, () => vg.box(0, 0, 1, 1)); });
    refuse("big 3", () => vg.raster(1024, 2048, big));
  });
  refuse("outside a scene", () => vg.raster(2, 2, px));
  refuse("ui.image not an image", () => ui.image(new Uint8Array([1, 2, 3])));
});
btn("Home", () => browserContext.changePage("/"));
