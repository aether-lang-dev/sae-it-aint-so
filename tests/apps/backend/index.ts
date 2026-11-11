"seeks backend";
// A test app for spec_app_backend (docs/app-backend.md): each button makes
// one call to the app's own backend process and shows what came back.
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
btn("Upper", () => show(backend.invoke("upper", "shout")));
btn("Fail", () => show(backend.invoke("fail", "on purpose")));
btn("Tick", () => show(backend.invoke("tick")));
btn("Unknown", () => show(backend.invoke("nope")));
btn("Chatty", () => show(backend.invoke("chatty", "intact")));
btn("Ignore", () => show(backend.invoke("ignore")));
btn("Exit", () => show(backend.invoke("exit")));
btn("After", () => show(backend.invoke("echo", "after")));
text(`running: ${backend.running()}`);
