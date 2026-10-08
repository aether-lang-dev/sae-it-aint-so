// Attempt: more storage than the origin's cap (4 MB). Expected: the write
// that would cross it throws a TypeError naming the cap, logged once. The
// keys are removed again, whatever happens.
const out = ui.text("cap_storage: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const keys = [0, 1, 2, 3, 4, 5].map((i) => `esc.cap.${i}`);
const mb = "x".repeat(1000000);
let kept = 0;
try {
  keys.forEach((k) => storage.remove(k));
  for (const k of keys) { storage.set(k, mb); kept++; }
  report(`cap_storage: ESCAPED ${kept} MB kept`);
} catch (e: any) {
  report(`cap_storage: refused: after ${kept} MB: ${e.message}`);
} finally {
  keys.forEach((k) => storage.remove(k));
}
