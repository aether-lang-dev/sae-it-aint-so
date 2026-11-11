"seeks backend";
// A test app for spec_app_backend_deaf (docs/app-backend.md): its backend
// stops reading after its first call, and Flood sends it more than a pipe
// holds. sae's window must not wait for the backend to read them.
const { text, btn, set_text, after } = ui;
const result = text("result: (none)");
const failed = text("failed: 0");
const gone = text("gone: (no)");
let failures = 0;
backend.on_gone((why: string) => set_text(gone, `gone: ${why}`));
btn("Deaf", () => backend.invoke("deaf").then(
  (r: string) => set_text(result, `result: ${r}`),
  (e: Error) => set_text(result, `failed: ${e.message}`)));
// 32 calls of 64 KB each, 2 MB in all, from a timer (so the click that asks
// returns first): the first few fill the pipe, the rest wait in sae.
const chunk = "y".repeat(65536);
btn("Flood", () => after(500, () => {
  for (let i = 0; i < 32; i++) {
    backend.invoke("more", chunk).then(
      () => {},
      (e: Error) => { failures++; set_text(failed, `failed: ${failures}: ${e.message}`); });
  }
  set_text(result, "result: flooded");
}));
