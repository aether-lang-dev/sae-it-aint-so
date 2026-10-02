// Default, rest, optional and TS `this` parameters.
function greet(name: string = "world", punct?: string): string {
  return "hi " + name + (punct || "!");
}
function sum(label: string, ...nums: number[]): string {
  let t = 0;
  for (const v of nums) t += v;
  return label + t;
}
function m(this: { k: number }, extra: number) { return this.k + extra; }
const late = (x: number, y: number = x * 2) => x + y;
print(greet(), greet("you", "?"), sum("s=", 1, 2, 3), sum("none"));
print(m.call({ k: 1 }, 2), late(1), late(1, 1));
// expect: hi world! hi you? s=6 none0
// expect: 3 3 2
