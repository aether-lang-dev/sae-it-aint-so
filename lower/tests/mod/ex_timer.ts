// examples/timer's countdown, headless, at made-up instants.
import { Countdown, formatTimerTime } from "./examples/timer/lib/timer.ts";
import { eq } from "./lib/check.ts";

eq("HH:MM:SS", [formatTimerTime(0), formatTimerTime(59), formatTimerTime(61), formatTimerTime(3600 + 23 * 60 + 7), formatTimerTime(10 * 3600)], ["00:00:00", "00:00:59", "00:01:01", "01:23:07", "10:00:00"]);
const c = new Countdown();
eq("starts at zero, stopped", [c.seconds(0), c.running], [0, false]);
c.start(0);
eq("Start with nothing on it does nothing", c.running, false);
c.addMinutes(1); c.addMinutes(5); c.addMinutes(10);
eq("+1m +5m +10m make 16 minutes", c.seconds(0), 960);
c.start(1000);
eq("it counts down from the instant it starts", [c.running, c.seconds(1000), c.seconds(31000), c.seconds(31001)], [true, 960, 930, 930]);
c.addMinutes(5);
eq("quick-add is refused while it runs", c.seconds(1000), 960);
c.stop(61000);
eq("Stop keeps what is left", [c.running, c.seconds(99999999)], [false, 900]);
c.start(100000);
eq("and Start goes on from there", c.seconds(160000), 840);
eq("it is not finished early", c.finished(999999), false);
eq("it finishes once, at zero", [c.finished(1000000), c.running, c.seconds(1000000), c.finished(1000001)], [true, false, 0, false]);
c.addMinutes(1); c.start(0); c.reset();
eq("Reset clears it and stops it", [c.running, c.seconds(5)], [false, 0]);
const s = new Countdown();
s.addMinutes(1); s.start(0);
eq("a display holds 00:00:01 until the last second is over", [s.seconds(59000), s.seconds(59999), s.seconds(60000)], [1, 1, 0]);
// expect: ok HH:MM:SS
// expect: ok starts at zero, stopped
// expect: ok Start with nothing on it does nothing
// expect: ok +1m +5m +10m make 16 minutes
// expect: ok it counts down from the instant it starts
// expect: ok quick-add is refused while it runs
// expect: ok Stop keeps what is left
// expect: ok and Start goes on from there
// expect: ok it is not finished early
// expect: ok it finishes once, at zero
// expect: ok Reset clears it and stops it
// expect: ok a display holds 00:00:01 until the last second is over
