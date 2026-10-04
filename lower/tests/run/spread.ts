// Spread, in arrays and in calls to a name or a dotted path.
const keys: string[] = [..."789"];
const more = [0, ...keys, "+", ...[1, 2],];
function sum3(a: number, b: number, c: number): number { return a + b + c; }
const nums = [1, 2, 3];
const calc = { base: 10, add(a: number, b: number) { return this.base + a + b; } };
const box = { calc: calc };
function args() { return [...arguments].length; }
print(keys.join(","), more.length, more.join(""), sum3(...nums), sum3(0, ...[5, 6]));
print(calc.add(...[1, 2]), box.calc.add(...nums.slice(1)), args(1, 2, 3, 4), [...[]].length);
print(Math.max(...nums), [..."ab"].map((c) => c.toUpperCase()).join(""));
// expect: 7,8,9 7 0789+12 6 11
// expect: 13 15 4 0
// expect: 3 AB
