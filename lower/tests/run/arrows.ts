// Arrow functions: bodies, parameters, and lexical this.
const add = (a: number, b: number): number => a + b;
const sq = x => x * x;
const noargs = () => { return "none"; };
const id = <T,>(v: T): T => v;
print(add(2, 3), sq(4), noargs(), id("same"));

const counter = {
  n: 10,
  bump: function () {
    const inc = (by: number) => { this.n = this.n + by; };
    inc(1);
    const nested = () => () => this.n;
    return nested()();
  }
};
print(counter.bump());

const fns: Array<() => number> = [];
fns.push(() => 1, () => 2);
print(fns[0]() + fns[1]());
const obj = { f: (s: string) => s.toUpperCase() };
print(obj.f("up"));
// expect: 5 16 none same
// expect: 11
// expect: 3
// expect: UP
