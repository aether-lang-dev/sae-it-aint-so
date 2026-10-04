// Modern JavaScript, run as written: none of this is rewritten any more.
class Counter {
  #n = 0;
  static made = 0;
  constructor() { Counter.made++; }
  inc() { this.#n++; return this; }
  get n() { return this.#n; }
  static has(o: object) { return #n in o; }
}
class Named extends Counter {
  constructor(public_name: string) { super(); this.name = public_name; }
  name: string;
  toString() { return `${this.name}=${this.n}`; }
}
const c = new Named("c").inc().inc();
print(String(c), Counter.made, Counter.has(c));
function* gen() { yield 1; yield* [2, 3]; }
const { a, b: [x, ...ys], ...rest } = { a: 1, b: [2, 3, 4], z: 5, w: 6 };
let p: number, q: number;
[p, q] = [q = 9, 8];
const key = "k";
const obj = { [key + "1"]: 1, ...rest, f() { return 7; } };
print([...gen()].join(","), a, x, ys.join("+"), Object.keys(obj).join(","), p, obj.f());
const deep = { u: { v: null as null | { w: number } } };
let lazy: number | undefined;
lazy ??= 4;
lazy **= 2;
print(deep.u?.v?.w ?? "none", deep.missing?.(), lazy, 2 ** 3 ** 2, 10n * 3n);
const tag = (s: TemplateStringsArray, ...v: number[]) => s.raw.join("|") + v.join("");
print(tag`a${1}b${2}c`, Math.max(...[1, 5, 3]), new Date(...[2020, 0, 2]).getDate(), [1, , ...[3]].length);
function outer() { return (() => arguments.length)(); }
const fs: string[] = [];
for (let i = 0; i < 3; i++) { fs.push(() => i); if (i === 1) break; }
try { JSON.parse("{"); } catch { print("catch without a binding"); }
{ const a = "inner"; print(a, outer(1, 2), fs.map((f) => f()).join(",")); }
const wait = (v: number) => new Promise<number>((r) => r(v));
(async () => { const v = await wait(41); print("awaited", v + 1); })();
// expect: c=2 1 true
// expect: 1,2,3 1 2 3+4 k1,z,w,f 9 7
// expect: none undefined 16 512 30
// expect: a|b|c12 5 2 3
// expect: catch without a binding
// expect: inner 2 0,1
// expect: awaited 42
