// examples/dashboards, headless: the metrics of Tsyne's gauge-dashboard and
// the dial settings of its dial-dashboard (Paul Hammant, MIT) at a held time,
// and the arc geometry written for sae.
import { SYSTEM, ORIENTATION, SIZES, DIALS, gaugeSweep, polar, arcD, dialAngle, dialValueAt, dialText, dialFraction } from "./examples/dashboards/lib/dashboards.ts";
import { eq } from "./lib/check.ts";

const q = (v: number) => Math.round(v * 1000) / 1000;
eq("at t=0 the system gauges read 30, 40, 65 and 20", SYSTEM.map((s) => s.value(0)), [30, 40, 65, 20]);
eq("the orientation gauges at t=0: 95, 30, 0, 50, 75", ORIENTATION.map((s) => s.value(0)), [95, 30, 0, 50, 75]);
eq("the sizes at t=0: 20, 45, 50, 0", SIZES.map((s) => s.value(0)), [20, 45, 50, 0]);
eq("memory is a sawtooth: it climbs for six seconds then drops", [SYSTEM[1].value(5.999) > SYSTEM[1].value(0.5), SYSTEM[1].value(6.01) < SYSTEM[1].value(5.9)], [true, true]);
eq("CPU spikes 40 higher where sin(2.3 t) is over 0.8", [q(SYSTEM[0].value(0.2)) < 60, SYSTEM[0].value(0.7) > 60], [true, true]);
let lo = 1000, hi = -1000;
for (const s of [...SYSTEM, ...ORIENTATION, ...SIZES]) for (let t = 0; t < 60; t += 0.37) { const v = s.value(t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
eq("every gauge stays between 0 and 100 over a minute", [lo >= 0, hi <= 100], [true, true]);
eq("sweeps: bottom arc 90, top 90, 3/4 is 270, full 360, speed 180, progress 240", [gaugeSweep(225, 315), gaugeSweep(45, 135), gaugeSweep(135, 45), gaugeSweep(90, 450), gaugeSweep(180, 0), gaugeSweep(150, 30)], [90, 90, 270, 360, 180, 240]);
eq("maths angles: 90 degrees is straight up on screen, 270 straight down", [polar(100, 100, 10, 90, true).map(q), polar(100, 100, 10, 270, true).map(q)], [[100, 90], [100, 110]]);
eq("screen angles: 90 degrees is down, 270 is up", [polar(100, 100, 10, 90, false).map(q), polar(100, 100, 10, 270, false).map(q)], [[100, 110], [100, 90]]);
eq("a quarter arc through the top of a gauge", arcD(100, 100, 10, 45, 90, true), "M107.07 92.93 A10 10 0 0 0 92.93 92.93");
eq("a big arc takes SVG's large-arc flag", arcD(100, 100, 10, 135, 270, true).split(" ")[5], "1");
eq("a full circle is two half arcs", arcD(100, 100, 10, 0, 360, true).match(/A/g)!.length, 2);

const D = (id: string) => DIALS.find((d) => d.id === id)!;
eq("twelve dials, in Tsyne's grid", [DIALS.length, DIALS.map((d) => [d.x, d.y].join(",")).slice(0, 4)], [12, ["70,85", "180,85", "300,85", "420,85"]]);
eq("a 270 degree dial: 0 is at 135, 50 at 270 (straight up), 100 at 405", [0, 50, 100].map((v) => dialAngle(D("volume"), v)), [135, 270, 405]);
eq("the half circle dial runs from -180 to 0", [0, 90, 180].map((v) => dialAngle(D("angle"), v)), [-180, -90, 0]);
eq("a pointer straight above a dial is the middle of its range", [dialValueAt(D("volume"), 70, 40), dialValueAt(D("temp"), 300, 40), dialValueAt(D("pan"), 300, 200)], [50, 22.5, 0]);
eq("to the right of the volume dial: (360 - 135) / 270 of 100, rounded", dialValueAt(D("volume"), 100, 85), 83);
eq("the gap at the bottom goes to the nearer end: left of it 0, right of it 100", [dialValueAt(D("volume"), 69, 130), dialValueAt(D("volume"), 71, 130)], [0, 100]);
eq("the temperature snaps to half degrees", dialValueAt(D("temp"), 330, 85), 27.5);
eq("the full circle: pointing right is 0 degrees of 360, pointing down is 90", [dialValueAt(D("hue"), 100, 250), dialValueAt(D("hue"), 70, 280)], [0, 90]);
eq("a half-circle dial: pointing up is 90", dialValueAt(D("angle"), 180, 200), 90);
eq("values are shown with the dial's decimals and suffix", [dialText(D("temp"), 21.5), dialText(D("volume"), 50), dialText(D("gain"), 5), dialText(D("hue"), 180)], ["21.5°", "50%", "5.0", "180°"]);
eq("fractions", [dialFraction(D("pan"), 0), dialFraction(D("temp"), 15)], [0.5, 0]);
// expect: ok at t=0 the system gauges read 30, 40, 65 and 20
// expect: ok the orientation gauges at t=0: 95, 30, 0, 50, 75
// expect: ok the sizes at t=0: 20, 45, 50, 0
// expect: ok memory is a sawtooth: it climbs for six seconds then drops
// expect: ok CPU spikes 40 higher where sin(2.3 t) is over 0.8
// expect: ok every gauge stays between 0 and 100 over a minute
// expect: ok sweeps: bottom arc 90, top 90, 3/4 is 270, full 360, speed 180, progress 240
// expect: ok maths angles: 90 degrees is straight up on screen, 270 straight down
// expect: ok screen angles: 90 degrees is down, 270 is up
// expect: ok a quarter arc through the top of a gauge
// expect: ok a big arc takes SVG's large-arc flag
// expect: ok a full circle is two half arcs
// expect: ok twelve dials, in Tsyne's grid
// expect: ok a 270 degree dial: 0 is at 135, 50 at 270 (straight up), 100 at 405
// expect: ok the half circle dial runs from -180 to 0
// expect: ok a pointer straight above a dial is the middle of its range
// expect: ok to the right of the volume dial: (360 - 135) / 270 of 100, rounded
// expect: ok the gap at the bottom goes to the nearer end: left of it 0, right of it 100
// expect: ok the temperature snaps to half degrees
// expect: ok the full circle: pointing right is 0 degrees of 360, pointing down is 90
// expect: ok a half-circle dial: pointing up is 90
// expect: ok values are shown with the dial's decimals and suffix
// expect: ok fractions
