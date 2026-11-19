// SPDX-License-Identifier: MIT
// Stopwatch, as a sae app. Ported from Tsyne's phone-apps/stopwatch (MIT,
// Copyright (c) 2025 Paul Hammant; see NOTICE.md): an analog dial with a
// sweeping second hand, MM:SS.cc below it, Start/Stop, Lap and Reset, and the
// laps listed newest first.
import { Stopwatch, STOPWATCH_SIZE, STOPWATCH_CENTER, STOPWATCH_RADIUS, calcSecondMarkerLine, calcStopwatchHandLine, formatStopwatchTime } from "./lib/stopwatch.ts";

const { vstack, hstack, text, btn, divider, spacer, scroll, clear, into, state, bind, set_text, timer } = ui;
const { scene, circle, line, fill, stroke, linecap } = vg;

const sw = new Stopwatch();
const display = state(formatStopwatchTime(0));
const turn = state(0);          // the hand's rotation, 0 to 1
let startStop = 0;
let lapList = 0;

const refresh = (): void => {
  const ms = sw.elapsed(Date.now());
  display.set(formatStopwatchTime(ms));
  turn.set((ms / 1000 % 60) / 60);
};

const drawLaps = (): void => {
  clear(lapList);
  into(lapList, () => {
    for (let i = sw.laps.length; i >= 1; i--) {
      hstack(4, () => { text(`Lap ${i}`); spacer(); text(formatStopwatchTime(sw.laps[i - 1])); });
    }
  });
};

scene(`0 0 ${STOPWATCH_SIZE} ${STOPWATCH_SIZE}`, STOPWATCH_SIZE, STOPWATCH_SIZE, () => {
  circle(STOPWATCH_CENTER, STOPWATCH_CENTER, STOPWATCH_RADIUS + 5, () => { fill("#f5f5f5"); stroke("#333333", 2); });
  for (let i = 0; i < 60; i++) {
    const l = calcSecondMarkerLine(i);
    line(l.x1, l.y1, l.x2, l.y2, () => stroke(i % 5 === 0 ? "#333333" : "#999999", i % 5 === 0 ? 2 : 1));
  }
  const h = calcStopwatchHandLine(0, STOPWATCH_RADIUS * 0.75);
  line(h.x1, h.y1, h.x2, h.y2, () => {
    stroke("#e74c3c", 3); linecap("round");
    vg.bind_transform(() => `rotate(${turn.value * 360} ${STOPWATCH_CENTER} ${STOPWATCH_CENTER})`);
  });
  circle(STOPWATCH_CENTER, STOPWATCH_CENTER, 5, () => fill("#333333"));
});
bind(text(""), display);
hstack(4, () => {
  startStop = btn("Start", () => { sw.toggle(Date.now()); set_text(startStop, sw.running ? "Stop" : "Start"); refresh(); });
  btn("Lap", () => { sw.lap(Date.now()); drawLaps(); });
  btn("Reset", () => { sw.reset(); set_text(startStop, "Start"); refresh(); drawLaps(); });
});
divider();
text("Laps");
scroll(() => { lapList = vstack(2); });

// Tsyne updates at 10 ms; a frame is as often as the screen shows
timer(20, () => { if (sw.running) refresh(); });
