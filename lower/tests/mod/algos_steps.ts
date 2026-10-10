// site/algos/steps.ts: apply replays each kind of step, Tally counts them,
// and a step no arm knows is a TypeError, not a silent no-op.
import { apply, Tally, unreachable } from "./algos/steps.ts";
import type { Step } from "./algos/steps.ts";
import { eq, throws } from "./lib/check.ts";

const a = [3, 1, 2];
apply(a, { kind: "compare", i: 0, j: 1 });
eq("compare changes nothing", a, [3, 1, 2]);
apply(a, { kind: "swap", i: 0, j: 2 });
eq("swap exchanges two", a, [2, 1, 3]);
apply(a, { kind: "write", i: 1, value: 9 });
eq("write sets one", a, [2, 9, 3]);
apply(a, { kind: "sorted", i: 1 });
eq("sorted changes nothing", a, [2, 9, 3]);

const t = new Tally();
const steps: Step[] = [
  { kind: "compare", i: 0, j: 1 }, { kind: "compare", i: 1, j: 2 },
  { kind: "swap", i: 0, j: 1 }, { kind: "write", i: 0, value: 1 }, { kind: "sorted", i: 0 },
];
steps.forEach((s) => t.count(s));
eq("tally by kind", [t.compares, t.swaps, t.writes], [2, 1, 1]);
eq("tally reads", `${t}`, "2 compares, 1 swaps, 1 writes");

const bogus = { kind: "rotate", i: 0 } as unknown as Step;
throws("apply refuses an unknown step", () => apply([1], bogus), TypeError, 'unknown step: {"kind":"rotate","i":0}');
throws("tally refuses an unknown step", () => t.count(bogus), TypeError, 'unknown step: {"kind":"rotate","i":0}');
throws("unreachable says what it got", () => unreachable(7 as never), TypeError, "unknown step: 7");
// expect: ok compare changes nothing
// expect: ok swap exchanges two
// expect: ok write sets one
// expect: ok sorted changes nothing
// expect: ok tally by kind
// expect: ok tally reads
// expect: ok apply refuses an unknown step
// expect: ok tally refuses an unknown step
// expect: ok unreachable says what it got
