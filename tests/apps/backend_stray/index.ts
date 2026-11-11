"seeks backend";
// A test app for spec_app_backend_stray (docs/app-backend.md): its backend
// writes text to stdout before it claims the channel, and sae stops it.
const { text, btn, set_text } = ui;
const result = text("result: (none)");
const gone = text("gone: (no)");
backend.on_gone((why: string) => set_text(gone, `gone: ${why}`));
btn("Echo", () => backend.invoke("echo", "x").then(
  (r: string) => set_text(result, `result: ${r}`),
  (e: Error) => set_text(result, `failed: ${e.message}`)));
