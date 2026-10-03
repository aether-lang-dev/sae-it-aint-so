// Two catch parameters of one name, in one function and at the top level:
// MicroQuickJS refuses the second as written; the lowerer renames it.
try { throw "a"; } catch (e) { print("top " + e); }
try { throw "b"; } catch (e) { print("top " + e); }
const f = (): void => {
  try { throw 1; } catch (e) { print(`fn ${e}`); }
  try { throw 2; } catch (e: any) { print(`fn ${e}`); }
  try { throw 3; } catch (e) {
    try { throw 4; } catch (e2) { print(`nested ${e2}`); }
    print(`outer still ${e}`);
  }
};
f();
// expect: top a
// expect: top b
// expect: fn 1
// expect: fn 2
// expect: nested 4
// expect: outer still 3
