// Attempt: block the UI thread with Atomics.wait. Expected: throws (the
// engine's main thread cannot block).
const out = ui.text("atomics_wait: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
try {
  const r = Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  report(`atomics_wait: ESCAPED ${r}`);
} catch (e: any) {
  report(`atomics_wait: refused: ${e && e.name}: ${e && e.message}`);
}
