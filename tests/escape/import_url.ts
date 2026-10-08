// Attempt: load code from a URL with import(). Expected: rejected, there is
// no module loader.
const out = ui.text("import_url: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
Function("return import('http://localhost:8091/index.js')")().then(
  () => report("import_url: ESCAPED loaded"),
  (e: any) => report(`import_url: refused: ${e && e.name}`));
