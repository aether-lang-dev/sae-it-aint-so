// Components as functions (docs/roadmap.md section 4): one clock face,
// `face(r)`, placed four times by transforms (Cosyne's svg-clock /
// svg-big-ben idea: compose one component), its hands bound to a time state
// that a timer advances. "Set 3:00" and "Set 6:30" pin the time for the spec
// (and for anyone who wants to see a known angle); "Live" follows the clock.
const { scene, g, circle, line, text_anchored, fill, stroke, transform, linecap } = vg;
const { btn, hstack } = ui;

const minutes = state(0);        // minutes past midnight, fractional
const live = state(true);

const tick = () => { if (live.value) { const d = new Date(); minutes.set(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60); } };
tick();
setInterval(tick, 1000);

// A face of radius r at the origin: the dial, twelve ticks, two hands bound
// to `minutes`. Place it with a transform on the group that calls it.
const face = (r: number) => g(() => {
  circle(0, 0, r, () => { fill("#fdfdf5"); stroke("#333333", r * 0.04) });
  for (let i = 0; i < 12; i++) {
    line(0, -r * 0.92, 0, -r * 0.8, () => { stroke("#333333", r * 0.03); transform(`rotate(${i * 30})`) });
  }
  line(0, r * 0.1, 0, -r * 0.5, () => {        // the hour hand
    stroke("#222222", r * 0.07); linecap("round");
    vg.bind_transform(() => `rotate(${(minutes.value / 60) * 30})`);
  });
  line(0, r * 0.12, 0, -r * 0.75, () => {      // the minute hand
    stroke("#222222", r * 0.045); linecap("round");
    vg.bind_transform(() => `rotate(${(minutes.value % 60) * 6})`);
  });
  circle(0, 0, r * 0.05, () => fill("#222222"));
});

ui.text("Four faces of one clock");
bind`Minutes past midnight: ${minutes}`;
scene("0 0 400 400", 400, 400, () => {
  g(() => { fill("#c9b58a"); circle(200, 200, 198) });           // the tower's crown
  g(() => { transform("translate(100 100)"); face(80); });
  g(() => { transform("translate(300 100)"); face(80); });
  g(() => { transform("translate(100 300)"); face(80); });
  g(() => { transform("translate(300 300) rotate(0)"); face(80); });
});
hstack(4, () => {
  btn("Set 3:00", () => { live.set(false); minutes.set(3 * 60); });
  btn("Set 6:30", () => { live.set(false); minutes.set(6 * 60 + 30); });
  btn("Live", () => { live.set(true); tick(); });
  btn("Home", () => browserContext.changePage("/"));
});
