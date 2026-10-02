// let/const bindings captured by closures keep per-iteration values.
const later: Array<() => string> = [];
for (let i = 0; i < 3; i++) {
  later.push(() => "for " + i);
}
for (const s of ["a", "b"]) {
  later.push(() => "of " + s);
}
let k = 0;
while (k < 2) {
  const kk = k * 10;
  later.push(() => "while " + kk);
  k++;
}
for (const name in { x: 1, y: 2 }) later.push(() => "in " + name);
for (var v = 0; v < 2; v++) {
  later.push(() => "var " + v);
}
for (const f of later) print(f());
// A let without an initializer is fresh each time round.
for (let j = 0; j < 2; j++) {
  let seen;
  if (j === 0) seen = "set";
  print("seen " + seen);
}
// expect: for 0
// expect: for 1
// expect: for 2
// expect: of a
// expect: of b
// expect: while 0
// expect: while 10
// expect: in x
// expect: in y
// expect: var 2
// expect: var 2
// expect: seen set
// expect: seen undefined
