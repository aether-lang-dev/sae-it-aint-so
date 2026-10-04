// TypeScript inside the new forms is erased, nothing else touched.
interface Shape { area(): number }
abstract class Base<T> implements Shape {
  protected readonly label: string = "base";
  private static count: number = 0;
  declare extra: string;
  abstract area(): number;
  describe(this: Base<T>, prefix?: string): string { return (prefix ?? "") + this.label + ":" + this.area(); }
}
class Square extends Base<number> {
  constructor(private_side: number) { super(); this.side = private_side; }
  side!: number;
  override area(): number { return this.side * this.side; }
  scale(k: number): Square;
  scale(k: number, round: boolean): Square;
  scale(k: number, round?: boolean): Square { const s = new Square(this.side * k); return round ? s : s; }
}
const sq = new Square(3).scale(2) satisfies Shape;
const n = (sq as Shape).area()!;
const list = <T,>(...xs: T[]): T[] => xs;
print(sq.describe("sq "), n, list<string>("a", "b").length, typeof (sq as any).extra);
// expect: sq base:36 36 2 undefined
