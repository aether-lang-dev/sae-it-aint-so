"seeks database notes";
"seeks backend";
"seeks control-bus";
"seeks documents";
"seeks open-urls";
"seeks local-filesystem";
// The app of tests/spec_app_sandbox.ae (docs/design/page-entry-sandbox.md):
// sae's own code, asked by the probe to act outside the page's grants, from
// the kinds of entry an app has that a browser page does not (a control bus
// request, a backend answer, a SQLite reply), and the app's capabilities
// still working beside it: storage, fs within its grants, a picked document,
// shell.open. The probe, __sae_probe, exists only when SAE_SANDBOX_PROBE and
// AETHER_UI_TEST_PORT are set (the spec's environment).
const { text, btn, set_text } = ui;
const P = (globalThis as any).__sae_probe;
const lines: string[] = [];
const out = text("sandbox: ready");
const show = (kind: string, s: string) => {
  lines.push(`sandbox: ${kind}: ${s}`);
  set_text(out, lines.join("\n"));
  print(`sandbox: ${kind}: ${s}`);
};
const probeAll = (kind: string): string => {
  const results = [P.fs(), P.write(), P.env(), P.tcp(), P.exec()];
  const depth = P.depth();
  const loose = results.filter((r: string) => !r.startsWith("refused")).length;
  return depth < 1 ? `ESCAPED no grant level in force (depth ${depth})`
    : loose > 0 ? `ESCAPED ${loose} of ${results.length} not refused (${results.join(" | ")})`
    : `refused at depth ${depth}`;
};
const probe = (kind: string) => show(kind, probeAll(kind));

if (!P) show("run", "ESCAPED there is no probe");
else {
  probe("run");
  setTimeout(() => probe("timeout"), 0);
  btn("probe click", () => probe("click"));
  btn("probe sqlite", () => { sqlite.notes.get("select count(*) as n from notes").then(() => probe("sqlite")); });
  btn("probe backend", () => { backend.invoke("echo", "x").then(() => probe("backend")); });
  bus.serve(async (command: string) => (command === "probe" ? probeAll("bus") : "unknown"));
}

// Positive controls: what the page is granted still works under the list.
btn("storage", () => {
  storage.set("sandbox", "kept");
  show("storage", storage.get("sandbox") === "kept" ? "ok" : "BROKEN");
});
btn("fs", () => {
  fs.write_text("$APPDATA/sandbox.txt", "written");
  show("fs", fs.read_text("$APPDATA/sandbox.txt") === "written" ? "ok" : "BROKEN");
});
btn("fs outside", () => {
  try { fs.read_text("/etc/hosts"); show("fs outside", "ESCAPED"); }
  catch (e: any) { show("fs outside", `refused: ${e.message}`); }
});
btn("document", async () => {
  const d = await documents.pick_open("Open");
  show("document", d ? `ok: ${await d.read_text()}` : "cancelled");
});
btn("shell", () => { shell.open("https://example.com/sandbox"); show("shell", "asked"); });
