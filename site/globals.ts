// What a page can see on globalThis: every own key (symbols and
// non-enumerables included) of the global object and of each prototype above
// it. spec_globals compares it with an explicit list, in the browser and in
// an app, so a new global (a quickjs-ng bump, a page-API addition) fails the
// spec until someone adds it on purpose. This page seeks nothing, so it gets
// no http, fs or shell, however it asks for them.
const levels: string[] = [];
let o: any = globalThis;
while (o) {
  levels.push(Reflect.ownKeys(o).map((k) => String(k)).sort().join(" "));
  o = Object.getPrototypeOf(o);
}
ui.text(`levels: ${levels.length}`);
levels.forEach((l, i) => ui.text(`G${i}: ${l}`));
ui.text(`computed: ${["ht" + "tp", "f" + "s", "sh" + "ell"].map((k) => typeof (globalThis as any)[k]).join(" ")}`);
const im = ui.text("import: pending");
Function("return import('./about.js')")().then(
  () => ui.set_text(im, "import: loaded"),
  (e: any) => ui.set_text(im, `import: rejected ${e && e.name}`));
ui.btn("Seeking page", () => browserContext.changePage("/globals_seeks"));
