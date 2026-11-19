// Trailing blocks (docs/design/trailing-blocks.md): f(a) { body } is
// f(a, () => { body }) and g { body } is g(() => { body }), on the same lines.
// A tiny builder with a parent stack, as the page API keeps one.
const out: string[] = [];
let depth = 0;
const node = (name: string, body?: () => void): string => {
  out.push(`${"  ".repeat(depth)}${name}`);
  if (body) { depth++; body(); depth--; }
  return name;
};
const g = (body?: () => void) => node("g", body);
const circle = (x: number, y: number, r: number, body?: () => void) => node(`circle ${x} ${y} ${r}`, body);
const fill = (c: string) => { out.push(`${"  ".repeat(depth)}fill ${c}`); };
const vg = { scene: (vb: string, body?: () => void) => node(`scene ${vb}`, body), g };
const box = { make() { return (n: number, body?: () => void) => node(`made ${n}`, body); } };

vg.scene("0 0 10 10") {
  g { fill("red") }
  for (let i = 0; i < 2; i++) circle(i, i, 1) { fill(`c${i}`) }
  if (depth > 0) {
    circle(9, 9, 9) {}
  }
}
const face = (r: number) => g {
  circle(0, 0, r) { fill("paper") }
}
face(5);
const held = circle(1, 2, 3) { fill("x") };
print(held);
function wrapper(): string {
  return g { fill("returned") }
}
print(wrapper());
box.make()(7) { fill("chained call") }
const opt: ((body: () => void) => string) | undefined = g;
opt?.() { fill("optional") }
const generic = <T,>(v: T, body?: () => void): T => { node(`generic ${v}`, body); return v; };
generic<number>(42) { fill("typed") }
circle(1, 1, 1,) { fill("trailing comma") }
circle(2, 2, 2) /* a comment */ { fill("comment") }
print(g { fill("len") }.length);
const self = { name: "outer", run() { g { fill(this.name) } } };
self.run();
// JavaScript keeps its own braces.
if (out.length > 0) { print("if") }
for (const k of [1]) { print("for", k) }
let w = 0;
while (w < 1) { w++ }
switch (w) { case 1: { print("case block") } }
try { throw new Error("e") } catch (e) { print("catch") }
function plain(a: number): number { return a }
class Base { constructor(public_: number) {} }
const mixin = (B: typeof Base) => B;
class Derived extends mixin(Base) { m() { return "method" } }
print(new Derived(1).m(), plain(3));
const obj = { a: { b: 1 } };
labelled: { print("label", obj.a.b); break labelled; }
g();
{ print("plain block after a call ended with ;") }
print(`template ${g { fill("in template") }}`);
// Allman style: the next line's '{' after a statement head, parameters or
// a class heritage is JavaScript's, as always.
class Allman extends Base
{
  m(): string
  {
    if (this)
    {
      return "allman";
    }
    return "";
  }
}
print(new Allman(1).m());
print(out.join("|"));
// expect: circle 1 2 3
// expect: g
// expect: 1
// expect: if
// expect: for 1
// expect: case block
// expect: catch
// expect: method 3
// expect: label 1
// expect: plain block after a call ended with ;
// expect: template g
// expect: allman
// expect: scene 0 0 10 10|  g|    fill red|  circle 0 0 1|    fill c0|  circle 1 1 1|    fill c1|  circle 9 9 9|g|  circle 0 0 5|    fill paper|circle 1 2 3|  fill x|g|  fill returned|made 7|  fill chained call|g|  fill optional|generic 42|  fill typed|circle 1 1 1|  fill trailing comma|circle 2 2 2|  fill comment|g|  fill len|g|  fill outer|g|g|  fill in template
