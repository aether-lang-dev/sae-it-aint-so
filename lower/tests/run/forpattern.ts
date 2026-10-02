// Destructuring in a for-of head, with closures that keep each iteration's
// bindings.
const later: Array<() => string> = [];
const pairs: Array<[string, number]> = [["a", 1], ["b", 2]];
for (const [name, n] of pairs) {
  later.push(() => name + n);
}
for (const { k, v = "dflt" } of [{ k: "x" }, { k: "y", v: "set" }]) later.push(() => k + "=" + v);
for (const f of later) print(f());
// expect: a1
// expect: b2
// expect: x=dflt
// expect: y=set
