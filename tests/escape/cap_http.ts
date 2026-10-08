"seeks outgoing-http";
// Attempt: more http requests in flight than the cap (8 per page).
// Expected: the ninth throws a TypeError naming the cap, logged once.
const out = ui.text("cap_http: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
let sent = 0;
try {
  for (let i = 0; i < 12; i++) { http.get(`/api/slow?ms=300&n=${i}`, () => {}); sent++; }
  report(`cap_http: ESCAPED ${sent} in flight`);
} catch (e: any) {
  report(`cap_http: refused: after ${sent}: ${e.message}`);
}
