// Erasable TypeScript disappears; nothing else changes.
import type { Thing } from "./thing";
interface Point {
  x: number;
  y: number;
}
type Pair<A, B = string> = { first: A; second: B } | null;
type Fn = <T>(a: T, ...rest: T[]) => T extends string ? "s" : "n";
type Keys = keyof Point;
declare const injected: number;
declare function external(a: string): void;
function over(a: string): string;
function over(a: number): number;
function over(a: any): any { return a; }
const pt: Point = { x: 1, y: 2 } as Point;
const sure = (pt as unknown as Point).x!;
const ok = { x: 5 } satisfies Partial<Point>;
const arr = new Array<number>(3);
function ident<T>(v: T): T { return v; }
const viaGeneric = ident<string>("g");
const viaAssert = <number>(<unknown>4);
let maybe: string | undefined;
let definite!: number;
const fn: (a: number) => void = (a) => { maybe = "set " + a; };
fn(1);
print(over("o"), sure, ok.x, arr.length, viaGeneric, viaAssert, maybe);
// expect: o 1 5 3 g 4 set 1
