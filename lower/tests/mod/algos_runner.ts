// site/algos/runner.ts against a mock listener: steps arrive numbered and
// in order, no more than asked for, and the end is reported exactly once.
import { Runner } from "./algos/runner.ts";
import type { Listener } from "./algos/runner.ts";
import { eq, mock } from "./lib/check.ts";

function* letters(): Generator<string, void, undefined> {
  yield* ["a", "b", "c"];
}

{
  const l = mock<Listener<string>>();
  const r = new Runner(letters(), l.it);
  eq("nothing before it is asked", l.calls, []);
  eq("advance(2) takes two", r.advance(2), 2);
  eq("each step numbered", l.calls, [["step", "a", 1], ["step", "b", 2]]);
  eq("not finished with a step left", r.finished, false);
  eq("advance() takes one", r.advance(), 1);
  eq("not finished until the source says so", r.finished, false);
  eq("the end takes no step", r.advance(5), 0);
  eq("done once, with the count", l.calls.slice(2), [["step", "c", 3], ["done", 3]]);
  eq("finished", [r.finished, r.steps], [true, 3]);
  eq("advancing a finished runner does nothing", [r.advance(3), l.calls.length], [0, 4]);
}

{
  const l = mock<Listener<string>>();
  const r = new Runner([][Symbol.iterator]() as Iterator<string, void, undefined>, l.it);
  eq("an empty source ends on the first advance", [r.advance(), l.calls], [0, [["done", 0]]]);
}

{
  const l = mock<Listener<number>>();
  function* forever(): Generator<number, void, undefined> { for (let i = 0; ; i++) yield i; }
  const r = new Runner(forever(), l.it);
  r.advance(1000);
  eq("an endless source is drained only as asked", [r.steps, r.finished, l.calls.at(-1)], [1000, false, ["step", 999, 1000]]);
}
// expect: ok nothing before it is asked
// expect: ok advance(2) takes two
// expect: ok each step numbered
// expect: ok not finished with a step left
// expect: ok advance() takes one
// expect: ok not finished until the source says so
// expect: ok the end takes no step
// expect: ok done once, with the count
// expect: ok finished
// expect: ok advancing a finished runner does nothing
// expect: ok an empty source ends on the first advance
// expect: ok an endless source is drained only as asked
