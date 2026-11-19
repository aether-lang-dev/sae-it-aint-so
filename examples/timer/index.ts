// SPDX-License-Identifier: MIT
// Timer, as a sae app. Ported from Tsyne's phone-apps/timer (MIT, Copyright
// (c) 2025 Paul Hammant; see NOTICE.md): a countdown with +1m, +5m and +10m,
// Start, Stop and Reset, and a notice ("Time is up!") when it reaches zero.
// A page has no notification service, so the notice is a line of output,
// `notify: Timer: Time is up!`, and the status line.
import { Countdown, formatTimerTime } from "./lib/timer.ts";

const { vstack, hstack, text, btn, divider, spacer, state, bind } = ui;

const cd = new Countdown();
const display = state(formatTimerTime(0));
const status = state("");
const refresh = (): void => display.set(formatTimerTime(cd.seconds(Date.now())));

spacer();
bind(text(""), display);
bind(text(""), status);
spacer();
hstack(4, () => {
  btn("+1m", () => { cd.addMinutes(1); refresh(); });
  btn("+5m", () => { cd.addMinutes(5); refresh(); });
  btn("+10m", () => { cd.addMinutes(10); refresh(); });
});
divider();
hstack(4, () => {
  btn("Start", () => { cd.start(Date.now()); status.set(cd.running ? "Running" : ""); refresh(); });
  btn("Stop", () => { cd.stop(Date.now()); status.set(""); refresh(); });
  btn("Reset", () => { cd.reset(); status.set(""); refresh(); });
});

setInterval(() => {
  if (!cd.running) return;
  if (cd.finished(Date.now())) {
    status.set("Time is up!");
    print("notify: Timer: Time is up!");
  }
  refresh();
}, 100);
