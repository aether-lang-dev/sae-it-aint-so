// examples/clock's arithmetic, headless: the dial and hands of Tsyne's
// phone-apps/clock (Paul Hammant, MIT) at known times.
import { calcHandLine, calcHourMarkerLine, handRotations, formatTime, formatDate, parseTime } from "./examples/clock/lib/clock.ts";
import { eq } from "./lib/check.ts";

const q = (v: number) => Math.round(v * 1000) / 1000;
const r = (l: { x1: number; y1: number; x2: number; y2: number }) => [q(l.x1), q(l.y1), q(l.x2), q(l.y2)];
eq("a hand at 0 points up from the centre", r(calcHandLine(0, 50)), [100, 100, 100, 50]);
eq("at a quarter turn it points right", r(calcHandLine(0.25, 50)), [100, 100, 150, 100]);
eq("at half it points down", r(calcHandLine(0.5, 50)), [100, 100, 100, 150]);
eq("at three quarters it points left", r(calcHandLine(0.75, 50)), [100, 100, 50, 100]);
eq("the 12 o'clock marker runs from 76.5 to 85.5 above the centre", r(calcHourMarkerLine(0)), [100, 23.5, 100, 14.5]);
eq("the 3 o'clock marker is to the right", r(calcHourMarkerLine(3)), [176.5, 100, 185.5, 100]);
eq("3:00:00", handRotations(3, 0, 0), { hour: 0.25, minute: 0, second: 0 });
eq("6:30:00: the hour hand is half way between 6 and 7", handRotations(6, 30, 0), { hour: 6.5 / 12, minute: 0.5, second: 0 });
eq("15:00:30 wraps to 3 and the minute hand has moved half a minute", handRotations(15, 0, 30), { hour: 0.25, minute: 0.5 / 60, second: 0.5 });
eq("times format as HH:MM:SS", [formatTime(3, 5, 9), formatTime(23, 59, 59), formatTime(0, 0, 0)], ["03:05:09", "23:59:59", "00:00:00"]);
eq("a date", formatDate(new Date(2026, 10, 19)), "Thursday, 19 November 2026");
eq("times parse", [parseTime("3:00"), parseTime("15:30:05"), parseTime(" 07:08 ")], [[3, 0, 0], [15, 30, 5], [7, 8, 0]]);
eq("and bad ones do not", [parseTime("24:00"), parseTime("12:60"), parseTime("noon"), parseTime("12:00:61"), parseTime("")], [null, null, null, null, null]);
// expect: ok a hand at 0 points up from the centre
// expect: ok at a quarter turn it points right
// expect: ok at half it points down
// expect: ok at three quarters it points left
// expect: ok the 12 o'clock marker runs from 76.5 to 85.5 above the centre
// expect: ok the 3 o'clock marker is to the right
// expect: ok 3:00:00
// expect: ok 6:30:00: the hour hand is half way between 6 and 7
// expect: ok 15:00:30 wraps to 3 and the minute hand has moved half a minute
// expect: ok times format as HH:MM:SS
// expect: ok a date
// expect: ok times parse
// expect: ok and bad ones do not
