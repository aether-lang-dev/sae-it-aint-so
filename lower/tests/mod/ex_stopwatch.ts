// examples/stopwatch's rules and dial, headless, at made-up instants.
import { Stopwatch, calcStopwatchHandLine, calcSecondMarkerLine, formatStopwatchTime } from "./examples/stopwatch/lib/stopwatch.ts";
import { eq } from "./lib/check.ts";

eq("MM:SS.cc", [formatStopwatchTime(0), formatStopwatchTime(1234), formatStopwatchTime(59990), formatStopwatchTime(61000), formatStopwatchTime(600500)], ["00:00.00", "00:01.23", "00:59.99", "01:01.00", "10:00.50"]);
const q = (v: number) => Math.round(v * 1000) / 1000;
const h = calcStopwatchHandLine(0.25, 60);
eq("a quarter turn points right from the centre of the 180 dial", [q(h.x1), q(h.y1), q(h.x2), q(h.y2)], [90, 90, 150, 90]);
const m0 = calcSecondMarkerLine(0), m1 = calcSecondMarkerLine(1);
eq("every fifth marker is longer: 64 to 76 against 70.4 out", [q(90 - m0.y1), q(90 - m0.y2), q(Math.hypot(m1.x1 - 90, m1.y1 - 90))], [64, 76, 70.4]);
const s = new Stopwatch();
eq("starts at zero, stopped", [s.elapsed(500), s.running], [0, false]);
s.lap(10);
eq("Lap does nothing while stopped", s.laps, []);
s.start(1000);
eq("it counts from when it started", s.elapsed(1750), 750);
s.lap(2000); s.lap(3500);
eq("laps are the elapsed times", s.laps, [1000, 2500]);
s.toggle(4000);
eq("Stop freezes the time", [s.running, s.elapsed(9999)], [false, 3000]);
s.toggle(10000);
eq("Start goes on from there", [s.running, s.elapsed(10500)], [true, 3500]);
s.reset();
eq("Reset clears time, laps and running", [s.running, s.elapsed(20000), s.laps], [false, 0, []]);
// expect: ok MM:SS.cc
// expect: ok a quarter turn points right from the centre of the 180 dial
// expect: ok every fifth marker is longer: 64 to 76 against 70.4 out
// expect: ok starts at zero, stopped
// expect: ok Lap does nothing while stopped
// expect: ok it counts from when it started
// expect: ok laps are the elapsed times
// expect: ok Stop freezes the time
// expect: ok Start goes on from there
// expect: ok Reset clears time, laps and running
