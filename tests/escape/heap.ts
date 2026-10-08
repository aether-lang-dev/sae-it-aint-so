// Attempt: allocate past the page's heap cap (32 MB). Expected: the engine
// throws (out of memory), the page catches it, the browser is unharmed.
const out = ui.text("heap: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const chunks: string[] = [];
try {
  for (;;) chunks.push("x".repeat(1 << 20) + chunks.length);
} catch (e: any) {
  const n = chunks.length;
  chunks.length = 0;
  report(`heap: refused: ${e && e.name} after ${n} MB`);
}
