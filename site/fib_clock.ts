// Fibonacci clock: one golden-spiral family for the hour lanes and the hand.
// The sae counterpart of aether-ui's apps/fib_clock/fib_clock.ae, written with
// trailing blocks (docs/design/trailing-blocks.md) as that one is written with
// Aether's: builders hold their children in a block, and ordinary loops run
// inside them.
//
// The artwork is built once and kept. What changes with the time is bound to
// three states (the hour, the minute, the second) that one timer sets once a
// second: the readout's text, the hour lane's and numeral's colour, the hand's
// angle, and which of twelve spirals shows and how far it has grown. Nothing
// is rebuilt. "Set 4:30" and "Set 9:15" pin the time (for the spec, and for
// a reference picture, as FIB_CLOCK_TIME does for the Aether app); "Live"
// follows the clock again.
const { scene, g, rect, circle, line, path, text_anchored, fill, stroke, linecap,
        transform, bind_text, bind_fill, bind_stroke, bind_transform, visible_when, measure } = vg;
const { btn, hstack } = ui;

const CX = 300, CY = 540;        // the dial's centre, in the 600 x 1040 viewBox
const DIAL = 86;
const PHI = 1.6180339887;
const INK = "#3a3a3a";
const HOT = "#f26b5b";
const SPIRAL = "#4fb3d0";
const DIM = "#b8b8b8";

const hour = state(12);          // 1 to 12
const minute = state(0);
const second = state(0);
const live = state(true);

const setTime = (h24: number, m: number, s: number) => batch {
  hour.set(h24 % 12 === 0 ? 12 : h24 % 12); minute.set(m); second.set(s);
}
const tick = () => { if (live.value) { const d = new Date(); setTime(d.getHours(), d.getMinutes(), d.getSeconds()); } };
const pin = (h: number, m: number) => { live.set(false); setTime(h, m, 0); };

// Lanes 1 to 6 above the centre, 7 to 12 below: opposite hours share a
// radius, spaced geometrically so the inner numerals stay legible.
const ring = (k: number) => (k > 6 ? k - 6 : k);
const hemi = (k: number) => (k > 6 ? 1 : -1);
const laneR = (k: number) => 118 * Math.pow(1.247, ring(k) - 1);
const axisOf = (k: number) => (hemi(k) * Math.PI) / 2;

// Every curve is r = R * phi^(-2 delta / pi) about the dial's centre, delta
// the angle from the lane's axis: scaling R nests the lanes at one pitch, and
// an axis turned by pi mirrors 7 to 12. Points are relative to the centre.
const spiralR = (R: number, delta: number) => R * Math.pow(PHI, (-delta * 2) / Math.PI);
const segment = (R: number, axis: number, a0: number, a1: number) => {
  const steps = Math.floor(Math.abs(a1 - a0) / 0.025) + 1;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const r = spiralR(R, a - axis);
    d += `${i === 0 ? "M" : "L"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)} `;
  }
  return d;
};

// The hand's spiral grows from its hour's lane toward the next as the minutes
// pass (lane 6 is the outermost and stays): a scale about the centre, the
// stroke kept 4 wide on screen.
const growth = (k: number) => (ring(k) < 6 ? Math.pow(1.247, (minute.value + second.value / 60) / 60) : 1);
const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
// A numeral's black background, padded px across and py up and down.
const label = (x: number, baseline: number, size: number, s: string, px: number, py: number) => {
  const m = measure(s, size);
  rect(x - m.width / 2 - px, baseline - m.ascent - py, m.width + px * 2, m.ascent + m.descent + py * 2) { fill("#000000") }
};
const stroked = (color: string, w: number) => { fill("none"); stroke(color, w); linecap("round") };

ui.text("Fibonacci Clock");
hstack(4) {
  btn("Set 4:30", () => pin(4, 30));
  btn("Set 9:15", () => pin(9, 15));
  btn("Live", () => { live.set(true); tick(); });
  btn("Home", () => browserContext.changePage("/"));
}
scene("0 0 600 1040", 460, 798) {
  rect(0, 0, 600, 1040) { fill("#000000") }
  text_anchored(CX, 56, 64, "middle", "Fibonacci Clock") { fill("#ffffff") }
  text_anchored(CX, 122, 42, "middle", "") {
    fill(HOT)
    bind_text(() => `${two(hour.value)}:${two(minute.value)}`)
  }
  g {
    transform(`translate(${CX} ${CY})`)
    // The twelve hour lanes, each split around its numeral; the current
    // hour's turns hot.
    for (let k = 1; k <= 12; k++) {
      const R = laneR(k), axis = axisOf(k), gap = 16 / R;
      for (const [a0, a1] of [[axis - 0.65, axis - gap], [axis + gap, axis + 0.7]]) {
        path(segment(R, axis, a0, a1)) {
          stroked(INK, 3.5)
          bind_stroke(() => [hour.value === k ? HOT : INK, 3.5])
        }
      }
    }
    // The classic dial: an outline, sixty ticks, its numerals under the hand.
    circle(0, 0, DIAL) { stroked("#ffffff", 1.25) }
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30, r0 = DIAL - (i % 5 === 0 ? 9 : 4);
      line(r0 * Math.cos(a), r0 * Math.sin(a), DIAL * Math.cos(a), DIAL * Math.sin(a)) {
        stroke("#ffffff", i % 5 === 0 ? 1 : 0.6)
      }
    }
    for (let n = 1; n <= 12; n++) {
      const a = (n * Math.PI) / 6 - Math.PI / 2;
      const x = 64 * Math.cos(a), baseline = 64 * Math.sin(a) + 5;
      label(x, baseline, 16, `${n}`, 2, 1);
      text_anchored(x, baseline, 16, "middle", `${n}`) { fill("#ffffff") }
    }
    // The hour hand, and the centre.
    line(0, 0, 0, -DIAL * 0.8) {
      stroke("#ffffff", 3); linecap("round")
      bind_transform(() => `rotate(${((hour.value % 12) + (minute.value + second.value / 60) / 60) * 30})`)
    }
    circle(0, 0, 8) { fill(HOT) }
    // One spiral per hour, from the centre out to its lane's shoulder; only
    // the current hour's shows.
    for (let k = 1; k <= 12; k++) {
      const R = laneR(k), axis = axisOf(k);
      const start = axis + ((Math.log(R / 3) / Math.log(PHI)) * Math.PI) / 2;
      path(segment(R, axis, start, axis - 0.65)) {
        stroked(SPIRAL, 4)
        visible_when(() => hour.value === k)
        bind_transform(() => `scale(${growth(k)})`)
        bind_stroke(() => [SPIRAL, 4 / growth(k)])
      }
    }
    // The lane numerals on black, over everything: every background
    // first, then every numeral (adjacent inner boxes overlap).
    for (let k = 1; k <= 12; k++) label(0, hemi(k) * laneR(k) + 9, 30, `${k}`, 6, 4);
    for (let k = 1; k <= 12; k++) {
      text_anchored(0, hemi(k) * laneR(k) + 9, 30, "middle", `${k}`) {
        fill(DIM)
        bind_fill(() => (hour.value === k ? HOT : DIM))
      }
    }
  }
  text_anchored(CX, 972, 36, "middle", "Time, drawn by a Fibonacci spiral") { fill(SPIRAL) }
  text_anchored(CX, 1030, 36, "middle", "1   1   2   3   5   8   13") { fill("#8a8a8a") }
}
tick();
ui.timer(1000) { tick() }
