// Destructuring declarations.
const src = { a: 1, b: 2, "c-d": 3, 0: "zero" };
const { a, b: bee, z = 9 } = src;
const { "c-d": cd, 0: first } = src;
const [p, , q = 7, ...rest] = [10, 20, undefined, 40, 50];
print(a, bee, z, cd, first);
print(p, q, rest.join("+"));
function pick() { return { x: "ex", y: "why" }; }
let { x, y } = pick();
print(x + y);
// expect: 1 2 9 3 zero
// expect: 10 7 40+50
// expect: exwhy
