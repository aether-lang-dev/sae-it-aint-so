// The AeVG grammar in TypeScript guise (docs/roadmap.md section 4): what a
// transpiled corpus file needs beyond circle/rect/rrect/line/path/text/g:
// polygon, polyline, ellipse, transforms and opacity and paint on groups,
// named gradients as defs, anchored and sized text, stroke caps and joins.
// Same shape as before: a block as the last argument, modifiers inside it.
const { text, btn } = ui;
const { scene, g, rect, circle, ellipse, polygon, polyline, line, path, text_anchored, text_sized,
        fill, stroke, opacity, transform, linecap, linejoin, defs, linear_gradient, radial_gradient } = vg;

text("AeVG grammar");
let dial = 0;
let turned = 0;
scene("0 0 100 100", 300, 300, () => {
  defs(() => {
    linear_gradient("sky", 0, 0, 1, 0, [[0, "#ff0000"], [1, "#0000ff"]]);
    radial_gradient("glow", 0.5, 0.5, 0.5, [[0, "#ffffff"], [1, "#008800"]]);
  });
  rect(0, 0, 100, 100, () => fill("#ffffff"));
  rect(5, 5, 40, 12, () => fill("url(#sky)"));            // a named gradient
  polygon([55, 5, 95, 5, 75, 20], () => fill("#dd8800"));   // points as an array
  polyline("5,30 20,22 35,30", () => { stroke("#008800", 3); linecap("round"); linejoin("round"); });
  ellipse(70, 30, 20, 7, () => fill("url(#glow)"));
  g(() => {                                  // paint and opacity cascade from a group
    fill("#0000ff");
    opacity(0.5);
    circle(15, 50, 8);                       // no fill of its own: the group's blue, at half
    circle(35, 50, 8, () => fill("#ff0000")); // its own red, still at half
  });
  g(() => {                                  // a transform on a group moves its children
    transform("translate(50 40)");
    rect(0, 0, 20, 20, () => fill("#aa00aa"));
    g(() => {                                // and nests
      transform("translate(25 0)");
      rect(0, 0, 20, 20, () => fill("#00aaaa"));
    });
  });
  dial = g(() => {                           // a group turned later: set_transform
    transform("rotate(0 50 80)");
    rect(50, 65, 30, 6, () => fill("#333333"));
    line(50, 80, 80, 80, () => { stroke("#333333", 1); linecap("square"); });
  });
  text_anchored(20, 95, 8, "middle", "mid", () => fill("#000000"));
  text_sized(60, 95, 6, "sized", () => fill("#000000"));
});
btn("Turn dial", () => { turned = (turned + 90) % 360; vg.set_transform(dial, `rotate(${turned} 50 80)`); });
btn("Home", () => browserContext.changePage("/"));
