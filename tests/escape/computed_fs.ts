// Attempt: reach fs and shell without naming them (the lowerer checks names;
// the kernel leaves the objects out). Expected: undefined, every route.
const out = ui.text("computed_fs: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const g: any = globalThis;
const routes = [
  () => g["f" + "s"],
  () => g["sh" + "ell"],
  () => (0, eval)("typeof " + "fs" + " === 'undefined' ? undefined : " + "fs"),
  () => Function("return this")()["f" + "s"],
  () => Reflect.get(g, "sh" + "ell"),
  () => Object.getOwnPropertyDescriptor(g, "f" + "s"),
];
const found = routes.map((r) => { try { return r(); } catch (e) { return undefined; } }).filter((v) => v !== undefined).length;
report(found === 0 ? `computed_fs: refused: ${routes.length} routes, nothing there` : `computed_fs: ESCAPED ${found} routes reached something`);
