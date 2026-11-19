// Attempt: allocate past the page's heap cap (32 MB). Expected: quickjs-ng
// (0.18, in Aether 0.915 and later) makes running out of memory an
// InternalError that page JavaScript cannot catch, so the try/catch below
// never sees it: the cap ends the page's script, sae reports the uncaught
// exception once, the browser lives, and a page loaded afterwards works.
// Nothing after the loop runs (tests/spec_escape.ae holds that).
ui.text("heap: trying");
const chunks: string[] = [];
try {
  for (;;) chunks.push("x".repeat(1 << 20) + chunks.length);
} catch (e: any) {
  chunks.length = 0;
  ui.text(`heap: ESCAPED: the page caught ${e && e.name}`);
}
ui.text("heap: ESCAPED: the script ran past the loop");
