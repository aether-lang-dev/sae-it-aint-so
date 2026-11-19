// SPDX-License-Identifier: MIT
// Clock, as a sae app. Ported from Tsyne's phone-apps/clock (MIT, Copyright
// (c) 2025 Paul Hammant; see NOTICE.md): an analog dial with hour, minute and
// second hands, the time in digits, the date. Tsyne's app reads a clock
// service it can mock; here the "Set time" row is that mock: a time typed in
// is held and ticks on, and "Live" follows the system clock again.
import { CLOCK_SIZE, CLOCK_CENTER, CLOCK_RADIUS, calcHourMarkerLine, calcHandLine, handRotations, formatTime, formatDate, parseTime } from "./lib/clock.ts";

const { vstack, hstack, text, btn, textfield, get_text, divider, state, bind } = ui;
const { scene, circle, line, fill, stroke, linecap } = vg;

// What the clock shows: seconds since midnight, and the date. `offset` is the
// shift from the system clock a typed time makes; null follows it live.
const secs = state(0);
const dateText = state("");
const status = state("");
let offset: number | null = null;
let heldDate = "";

const systemSeconds = (): number => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };

const tick = (): void => {
  if (offset === null) {
    secs.set(systemSeconds());
    dateText.set(formatDate(new Date()));
  } else {
    secs.set(((systemSeconds() + offset) % 86400 + 86400) % 86400);
    dateText.set(heldDate);
  }
};

const hands = () => handRotations(Math.floor(secs.value / 3600), Math.floor(secs.value / 60) % 60, secs.value % 60);
const digits = computed(() => formatTime(Math.floor(secs.value / 3600), Math.floor(secs.value / 60) % 60, secs.value % 60), secs);

scene(`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`, CLOCK_SIZE, CLOCK_SIZE, () => {
  circle(CLOCK_CENTER, CLOCK_CENTER, CLOCK_RADIUS + 5, () => { fill("#f5f5f5"); stroke("#333333", 3); });
  for (let i = 0; i < 12; i++) {
    const l = calcHourMarkerLine(i);
    line(l.x1, l.y1, l.x2, l.y2, () => stroke("#333333", i % 3 === 0 ? 3 : 1));
  }
  const hand = (length: number, color: string, width: number, rot: () => number) => {
    const l0 = calcHandLine(0, length);
    line(l0.x1, l0.y1, l0.x2, l0.y2, () => {
      stroke(color, width); linecap("round");
      vg.bind_transform(() => `rotate(${rot() * 360} ${CLOCK_CENTER} ${CLOCK_CENTER})`);
    });
  };
  hand(CLOCK_RADIUS * 0.5, "#333333", 4, () => hands().hour);
  hand(CLOCK_RADIUS * 0.75, "#333333", 3, () => hands().minute);
  hand(CLOCK_RADIUS * 0.85, "#e74c3c", 1, () => hands().second);
  circle(CLOCK_CENTER, CLOCK_CENTER, 5, () => fill("#333333"));
});
divider();
bind(text(""), digits);
bind(text(""), dateText);
const tz = -new Date().getTimezoneOffset();
text(`Timezone: UTC${tz < 0 ? "-" : "+"}${String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0")}:${String(Math.abs(tz) % 60).padStart(2, "0")}`);
divider();
hstack(4, () => {
  const field = textfield("HH:MM:SS");
  btn("Set time", () => {
    const t = parseTime(get_text(field));
    if (!t) { status.set("That is not a time of day (HH:MM or HH:MM:SS)"); return; }
    offset = t[0] * 3600 + t[1] * 60 + t[2] - systemSeconds();
    heldDate = formatDate(new Date());
    status.set("");
    tick();
  });
  btn("Live", () => { offset = null; status.set(""); tick(); });
});
bind(text(""), status);

tick();
setInterval(tick, 1000);
