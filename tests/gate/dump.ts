// tests/gate/dump.ts -- what a page really sees of sae's own objects: for
// each name the browser can install, whether it exists, its typeof and
// .length, and for an object every own key with its typeof, and .length for
// a function. tests/check_gate.sh runs it headless and compares the lines
// with `sae --gate-describe`; the names are looked up by computed key so the
// lowerer's refusal of unsought names does not apply.
const names = ["ui", "vg", "storage", "browserContext", "performance", "print",
  "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame",
  "state", "computed", "bind", "bind_enabled", "bind_hidden", "each", "batch",
  "http", "fs", "documents", "clipboard", "bus", "backend", "printing", "shell",
  "sqlite", "natives",
  // the hidden objects a wrapper takes and deletes: a page must never see one
  "__sae_documents", "__sae_clipboard", "__sae_bus", "__sae_backend", "__sae_natives"];
const g: any = globalThis;
const shape = (v: any): string => {
  const t = typeof v;
  return t === "function" ? `function length=${v.length}` : t;
};
for (const n of names) {
  const v = g[n];
  print(`G ${n} ${v === undefined ? "absent" : shape(v)}`);
  if (v !== undefined && v !== null && typeof v === "object") {
    for (const k of Reflect.ownKeys(v).map((x) => String(x)).sort()) {
      print(`M ${n}.${k} ${shape(v[k])}`);
    }
  }
}
print(`M Date.now ${shape(Date.now)}`);
