// Template literals become concatenation, keeping their lines.
const who = "page";
const n = 2;
print(`hello ${who}`);
print(`${n}${n}`);
print(`sum ${n + n} and ${`nested ${who}`}`);
print(`quote " and \` and \${not} and back\\slash`);
print(`two
lines`);
const err = new Error("x");
print(`line of this statement: ${err.stack ? "ok" : "ok"}`);
// expect: hello page
// expect: 22
// expect: sum 4 and nested page
// expect: quote " and ` and ${not} and back\slash
// expect: two
// expect: lines
// expect: line of this statement: ok
