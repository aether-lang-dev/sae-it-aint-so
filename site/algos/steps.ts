// What a sorting algorithm says it is doing, one step at a time. An
// algorithm is a generator that sorts its own array and yields a Step
// before each thing it does, so whoever drains it (a Runner, a Lane, a
// test) can replay the work on a copy, count it, or draw it.

export type Step =
  | { readonly kind: "compare"; readonly i: number; readonly j: number }
  | { readonly kind: "swap"; readonly i: number; readonly j: number }
  | { readonly kind: "write"; readonly i: number; readonly value: number }
  | { readonly kind: "sorted"; readonly i: number };

export type Kind = Step["kind"];

export interface Algorithm {
  readonly name: string;
  sort(a: number[]): Generator<Step, void, undefined>;
}

// The default arm of an exhaustive switch: the type checker proves it
// unreachable, and at run time it reports a step no arm knows.
export function unreachable(s: never): never {
  throw new TypeError(`unknown step: ${JSON.stringify(s)}`);
}

// Do to `a` what `s` says was done; a compare or sorted changes nothing.
export function apply(a: number[], s: Step): void {
  switch (s.kind) {
    case "compare":
    case "sorted":
      return;
    case "swap":
      [a[s.i], a[s.j]] = [a[s.j], a[s.i]];
      return;
    case "write":
      a[s.i] = s.value;
      return;
    default:
      unreachable(s);
  }
}

// The work an algorithm did, by kind.
export class Tally {
  compares = 0;
  swaps = 0;
  writes = 0;

  count(s: Step): void {
    switch (s.kind) {
      case "compare": this.compares++; return;
      case "swap": this.swaps++; return;
      case "write": this.writes++; return;
      case "sorted": return;
      default: unreachable(s);
    }
  }

  toString(): string {
    return `${this.compares} compares, ${this.swaps} swaps, ${this.writes} writes`;
  }
}
