"seeks backend";
// A test app for spec_app_backend_wslc (docs/app-backend.md): its backend is
// tests/apps/backend's program built for Linux into the image
// sae-backend-test:dev (build-image.sh), run by wslc on Windows. Anywhere
// else sae refuses it, and every call fails with why.
const { text, btn, set_text } = ui;
const result = text("result: (none)");
const events = text("events: (none)");
const gone = text("gone: (no)");
let heard: string[] = [];
backend.on("tick", (d: string) => { heard.push(d); set_text(events, `events: ${heard.join(", ")}`); });
backend.on_gone((why: string) => set_text(gone, `gone: ${why}`));
const show = (p: Promise<string>) =>
  p.then((r: string) => set_text(result, `result: ${r}`),
         (e: Error) => set_text(result, `failed: ${e.message}`));
btn("Echo", () => show(backend.invoke("echo", "a string, as given")));
btn("Greet", () => show(backend.invoke("greet", "page")));
btn("Chatty", () => show(backend.invoke("chatty", "intact")));
btn("Tick", () => show(backend.invoke("tick")));
btn("Exit", () => show(backend.invoke("exit")));
