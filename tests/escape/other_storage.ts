// Attempt: name another origin's storage by key. Expected: each key is
// refused (keys are letters, digits, '.', '_' and '-'), so no path reaches
// out of this origin's folder.
const out = ui.text("other_storage: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const keys = ["../http___localhost_8091/token", "..", "/etc/passwd", "a/b", "..%2Fx", ".hidden", "C:\\x"];
let refused = 0;
for (const k of keys) {
  try { storage.get(k); storage.set(k, "x"); } catch (e) { refused++; }
}
report(refused === keys.length ? `other_storage: refused: ${refused} of ${keys.length} keys` : `other_storage: ESCAPED ${keys.length - refused} of ${keys.length} keys taken`);
