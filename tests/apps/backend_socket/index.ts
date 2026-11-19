"seeks backend";
"seeks documents";
// A test app for spec_app_backend_socket (docs/design/ipc-backends.md): its
// backend runs on a socket, contained; each button makes one call and shows
// what came back.
const { text, btn, textfield, set_text, get_text } = ui;
const result = text("result: (none)");
const events = text("events: (none)");
const gone = text("gone: (no)");
const restarted = text("restarted: (no)");
const arg = textfield("arg");
let heard: string[] = [];
backend.on("tick", (d: string) => { heard.push(d); set_text(events, `events: ${heard.join(", ")}`); });
backend.on_gone((why: string) => set_text(gone, `gone: ${why}`));
const show = (p: Promise<string>) =>
  p.then((r: string) => set_text(result, `result: ${r}`),
         (e: Error) => set_text(result, `failed: ${e.message}`));
const call = (name: string) => () => show(backend.invoke(name, get_text(arg)));
btn("Echo", call("echo"));
btn("Kind", call("kind"));
btn("Tick", call("tick"));
btn("Chatty", call("chatty"));
btn("ReadPath", call("read_path"));
btn("Env", call("env"));
btn("Exec", call("exec"));
btn("Hang", call("hang"));
// A document the person picks, handed to the backend as an open descriptor.
btn("Hand", () => show((async () => {
  const d = await documents.pick_open("A file for the backend");
  if (!d) return "cancelled";
  return backend.invoke("read_handed", "", d);
})()));
// Not a document documents gave: a number on a made-up object.
btn("Forged", () => show((async () => {
  const fake: any = {};
  fake[Symbol.for("sae.document")] = 99;
  return backend.invoke("read_handed", "", fake);
})()));
btn("Restart", () => {
  set_text(restarted, "restarted: waiting");
  backend.restart().then(() => set_text(restarted, `restarted: running ${backend.running()}`),
                         (e: Error) => set_text(restarted, `restarted: failed: ${e.message}`));
});
text(`running: ${backend.running()}`);
