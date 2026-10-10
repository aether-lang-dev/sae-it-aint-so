// site/algos/sorts.ts: every algorithm sorts, its steps replayed on a copy
// sort the copy too (the step stream is the whole truth about the work),
// every index is marked sorted exactly once, and the counts are the
// textbook's on inputs whose counts the textbook knows.
import { algorithms, bubble, insertion, selection, quick, merge } from "./algos/sorts.ts";
import { apply, Tally } from "./algos/steps.ts";
import type { Algorithm, Step } from "./algos/steps.ts";
import { shuffled } from "./algos/random.ts";
import { eq } from "./lib/check.ts";

const ascending = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function run(algo: Algorithm, input: readonly number[]): { out: number[]; steps: Step[] } {
  const out = [...input];
  const steps = [...algo.sort(out)];
  return { out, steps };
}

function tally(steps: Step[]): Tally {
  const t = new Tally();
  steps.forEach((s) => t.count(s));
  return t;
}

eq("five algorithms, by name", algorithms.map((a) => a.name), ["Bubble", "Insertion", "Selection", "Quick", "Merge"]);

for (const algo of algorithms) {
  const faults: string[] = [];
  for (const n of [0, 1, 2, 3, 8, 24]) {
    for (let seed = 1; seed <= 12; seed++) {
      const input = shuffled(n, seed);
      const { out, steps } = run(algo, input);
      const replay = [...input];
      steps.forEach((s) => apply(replay, s));
      const marks = steps.filter((s) => s.kind === "sorted").map((s) => s.i).sort((p, q) => p - q);
      const inRange = steps.every((s) => [s.i, "j" in s ? s.j : 0].every((k) => k >= 0 && k < Math.max(n, 1)));
      if (out.join() !== ascending(n).join()) faults.push(`n=${n} seed=${seed}: ${out}`);
      if (replay.join() !== out.join()) faults.push(`n=${n} seed=${seed}: replay ${replay}`);
      if (marks.join() !== ascending(n).map((v) => v - 1).join()) faults.push(`n=${n} seed=${seed}: marked ${marks}`);
      if (!inRange) faults.push(`n=${n} seed=${seed}: an index out of range`);
    }
  }
  eq(`${algo.name} sorts, replays and marks every index once`, faults, []);
}

// Known counts, n = 8.
const n = 8, reversed = ascending(n).reverse();
const counts = (algo: Algorithm, input: number[]) => {
  const t = tally(run(algo, input).steps);
  return [t.compares, t.swaps, t.writes];
};
eq("bubble on sorted input: one pass, no swaps", counts(bubble, ascending(n)), [n - 1, 0, 0]);
eq("bubble on reversed input: every pair, every swap", counts(bubble, reversed), [28, 28, 0]);
eq("insertion on sorted input: n - 1 compares", counts(insertion, ascending(n)), [n - 1, 0, 0]);
eq("insertion on reversed input: one swap per inversion", counts(insertion, reversed), [28, 28, 0]);
eq("selection always compares every pair", [counts(selection, ascending(n))[0], counts(selection, reversed)[0]], [28, 28]);
eq("selection swaps at most n - 1 times", counts(selection, reversed)[1] <= n - 1, true);
eq("quick on sorted input degrades to every pair", counts(quick, ascending(n))[0], 28);
eq("merge writes n log n", counts(merge, reversed)[2], 24);
eq("merge on reversed input: 12 compares", counts(merge, reversed)[0], 12);

// The demo's own race (site/algos.ts: 24 bars, seed 7). spec_algos expects these.
for (const algo of algorithms) {
  const steps = run(algo, shuffled(24, 7)).steps;
  print(`${algo.name}: ${steps.length} steps, ${tally(steps)}`);
}

// A generator pauses: three steps of quicksort, then the rest.
const a = shuffled(24, 7);
const g = quick.sort(a);
const head = [g.next().value, g.next().value, g.next().value];
eq("quick starts by comparing against the pivot", head, [
  { kind: "compare", i: 23, j: 0 }, { kind: "compare", i: 23, j: 1 }, { kind: "compare", i: 23, j: 2 },
]);
eq("and a paused sort leaves its array half done", a.join() === ascending(24).join(), false);
[...g];
eq("draining it finishes the sort", a, ascending(24));
// expect: ok five algorithms, by name
// expect: ok Bubble sorts, replays and marks every index once
// expect: ok Insertion sorts, replays and marks every index once
// expect: ok Selection sorts, replays and marks every index once
// expect: ok Quick sorts, replays and marks every index once
// expect: ok Merge sorts, replays and marks every index once
// expect: ok bubble on sorted input: one pass, no swaps
// expect: ok bubble on reversed input: every pair, every swap
// expect: ok insertion on sorted input: n - 1 compares
// expect: ok insertion on reversed input: one swap per inversion
// expect: ok selection always compares every pair
// expect: ok selection swaps at most n - 1 times
// expect: ok quick on sorted input degrades to every pair
// expect: ok merge writes n log n
// expect: ok merge on reversed input: 12 compares
// expect: Bubble: 480 steps, 276 compares, 180 swaps, 0 writes
// expect: Insertion: 402 steps, 198 compares, 180 swaps, 0 writes
// expect: Selection: 320 steps, 276 compares, 20 swaps, 0 writes
// expect: Quick: 188 steps, 122 compares, 42 swaps, 0 writes
// expect: Merge: 222 steps, 86 compares, 0 swaps, 112 writes
// expect: ok quick starts by comparing against the pivot
// expect: ok and a paused sort leaves its array half done
// expect: ok draining it finishes the sort
