// Five sorts, each a generator over its own array: the algorithm reads as
// the textbook writes it, and every comparison, swap and write is a `yield`.
// Pausing a recursive quicksort mid-partition is then nothing more than not
// asking it for its next step.
import type { Algorithm, Step } from "./steps.ts";

type Steps<R = void> = Generator<Step, R, undefined>;

// Is a[i] > a[j]? Said first, then answered: `yield*` hands back the
// helper's return value, so a caller reads `if (yield* after(a, i, j))`.
function* after(a: number[], i: number, j: number): Steps<boolean> {
  yield { kind: "compare", i, j };
  return a[i] > a[j];
}

function* swap(a: number[], i: number, j: number): Steps {
  yield { kind: "swap", i, j };
  [a[i], a[j]] = [a[j], a[i]];
}

function* write(a: number[], i: number, value: number): Steps {
  yield { kind: "write", i, value };
  a[i] = value;
}

function* sorted(from: number, to: number): Steps {
  for (let i = from; i < to; i++) yield { kind: "sorted", i };
}

export const bubble = {
  name: "Bubble",
  *sort(a: number[]): Steps {
    for (let end = a.length - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        if (yield* after(a, i, i + 1)) {
          yield* swap(a, i, i + 1);
          swapped = true;
        }
      }
      yield { kind: "sorted", i: end };
      if (!swapped) return yield* sorted(0, end);
    }
    yield* sorted(0, Math.min(1, a.length));
  },
} satisfies Algorithm;

export const insertion = {
  name: "Insertion",
  *sort(a: number[]): Steps {
    for (let i = 1; i < a.length; i++) {
      for (let j = i; j > 0 && (yield* after(a, j - 1, j)); j--) {
        yield* swap(a, j - 1, j);
      }
    }
    yield* sorted(0, a.length);
  },
} satisfies Algorithm;

export const selection = {
  name: "Selection",
  *sort(a: number[]): Steps {
    for (let i = 0; i < a.length; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) {
        if (yield* after(a, min, j)) min = j;
      }
      if (min !== i) yield* swap(a, i, min);
      yield { kind: "sorted", i };
    }
  },
} satisfies Algorithm;

// Lomuto: the last element is the pivot; returns where it lands.
function* partition(a: number[], lo: number, hi: number): Steps<number> {
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (yield* after(a, hi, j)) {
      if (i !== j) yield* swap(a, i, j);
      i++;
    }
  }
  if (i !== hi) yield* swap(a, i, hi);
  return i;
}

function* quickRange(a: number[], lo: number, hi: number): Steps {
  if (lo > hi) return;
  if (lo === hi) return yield { kind: "sorted", i: lo };
  const p = yield* partition(a, lo, hi);
  yield { kind: "sorted", i: p };
  yield* quickRange(a, lo, p - 1);
  yield* quickRange(a, p + 1, hi);
}

export const quick = {
  name: "Quick",
  sort: (a: number[]): Steps => quickRange(a, 0, a.length - 1),
} satisfies Algorithm;

// Top-down, [lo, hi): both halves sorted, then merged back by writes.
function* mergeRange(a: number[], lo: number, hi: number): Steps {
  if (hi - lo < 2) return;
  const mid = (lo + hi) >> 1;
  yield* mergeRange(a, lo, mid);
  yield* mergeRange(a, mid, hi);
  const merged: number[] = [];
  let i = lo, j = mid;
  while (i < mid && j < hi) merged.push((yield* after(a, i, j)) ? a[j++] : a[i++]);
  merged.push(...a.slice(i, mid), ...a.slice(j, hi));
  for (const [k, v] of merged.entries()) yield* write(a, lo + k, v);
}

export const merge = {
  name: "Merge",
  *sort(a: number[]): Steps {
    yield* mergeRange(a, 0, a.length);
    yield* sorted(0, a.length);
  },
} satisfies Algorithm;

export const algorithms: readonly Algorithm[] = [bubble, insertion, selection, quick, merge];
