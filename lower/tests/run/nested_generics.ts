// Type arguments nest: the `>>` and `>>>` that close them are one token to
// the tokenizer (a shift), used here one `>` at a time. Shifts stay shifts.
interface Box<T> { v: T }
function make<T>(v: T): Box<T> { return { v }; }
const index = new Map<string, Set<number>>();
index.set("a", new Set<number>([1, 2]));
let deep: Map<string, Map<string, Array<number>>> = new Map();
deep.set("x", new Map([["y", [3]]]));
const boxed = make<Box<number>>({ v: 4 });
const triple = make<Array<Array<Array<number>>>>([[[5]]]);
function first<T extends Array<Array<number>>>(t: T): number { return t[0][0]; }
type Grid<C = Map<string, Box<number>>> = Array<C>;
const grid: Grid = [];
print(index.get("a")!.size, deep.get("x")!.get("y")![0], boxed.v.v, triple.v[0][0][0], first([[6]]), grid.length);
const a = 64, b = 2, c = 1;
print(a >> b, -a >>> 28, a < b >> c, (a > b) === (b < a));
const shifted = a<b>>(c);
print(shifted);
// expect: 2 3 4 5 6 0
// expect: 16 15 false true
// expect: false
