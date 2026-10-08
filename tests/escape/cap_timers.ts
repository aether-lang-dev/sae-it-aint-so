// Attempt: more timers and animation frames pending than the cap (256 per
// page). Expected: the 257th throws a TypeError naming the cap, logged once.
const out = ui.text("cap_timers: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
let set = 0;
try {
  for (let i = 0; i < 200; i++) { setTimeout(() => {}, 60000); set++; }
  for (let i = 0; i < 100; i++) { ui.after(60000, () => {}); set++; }
  for (let i = 0; i < 100; i++) { requestAnimationFrame(() => {}); set++; }
  report(`cap_timers: ESCAPED ${set} pending`);
} catch (e: any) {
  report(`cap_timers: refused: after ${set}: ${e.message}`);
}
