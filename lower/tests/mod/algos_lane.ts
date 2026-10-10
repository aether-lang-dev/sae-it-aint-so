// site/algos/lane.ts against a mock BarView and scripted algorithms: what
// a Lane tells its view for each kind of step, and how a Race picks a winner.
import { Lane, Race } from "./algos/lane.ts";
import type { BarView } from "./algos/lane.ts";
import type { Algorithm, Step } from "./algos/steps.ts";
import { eq, mock } from "./lib/check.ts";

// An algorithm that yields what it is given and does nothing itself.
const scripted = (name: string, steps: Step[]): Algorithm => ({
  name,
  *sort(_a: number[]) { yield* steps; },
});
const bars = (calls: unknown[][]) => calls.filter((c) => c[0] === "bar");

{
  const v = mock<BarView>();
  const lane = new Lane(scripted("S", []), [3, 1, 2], v.it);
  eq("a new lane draws every bar idle, then zero counts", v.calls, [
    ["bar", 0, 3, "idle"], ["bar", 1, 1, "idle"], ["bar", 2, 2, "idle"],
    ["counts", { compares: 0, swaps: 0, writes: 0 }, 0],
  ]);
  eq("and has taken no step", [lane.steps, lane.finished, lane.algorithm.name], [0, false, "S"]);
}

{
  const v = mock<BarView>();
  const lane = new Lane(scripted("S", [
    { kind: "compare", i: 0, j: 1 },
    { kind: "swap", i: 0, j: 1 },
    { kind: "sorted", i: 2 },
    { kind: "write", i: 2, value: 9 },
  ]), [3, 1, 2], v.it);
  v.calls.length = 0;

  lane.advance();
  eq("a compare lights both bars", v.calls, [
    ["bar", 0, 3, "compare"], ["bar", 1, 1, "compare"],
    ["counts", { compares: 1, swaps: 0, writes: 0 }, 1],
  ]);
  v.calls.length = 0;

  lane.advance();
  eq("the next step puts them out, then a swap lights them at their new heights", v.calls, [
    ["bar", 0, 3, "idle"], ["bar", 1, 1, "idle"],
    ["bar", 0, 1, "swap"], ["bar", 1, 3, "swap"],
    ["counts", { compares: 1, swaps: 1, writes: 0 }, 2],
  ]);
  eq("the lane's own bars follow", lane.bars, [1, 3, 2]);
  v.calls.length = 0;

  lane.advance();
  eq("sorted settles a bar", bars(v.calls).slice(-1), [["bar", 2, 2, "sorted"]]);
  v.calls.length = 0;

  lane.advance();
  eq("a sorted bar written stays sorted, at its new height", bars(v.calls), [["bar", 2, 9, "sorted"]]);
  eq("roles so far", lane.roles, ["idle", "idle", "sorted"]);
  v.calls.length = 0;

  lane.advance();
  eq("the end settles every bar left and reports once", v.calls, [
    ["bar", 0, 1, "sorted"], ["bar", 1, 3, "sorted"],
    ["done", { compares: 1, swaps: 1, writes: 1 }, 4],
  ]);
  eq("finished", [lane.finished, lane.steps, lane.advance(10)], [true, 4, 0]);
}

{
  const v = mock<BarView>();
  const lane = new Lane(scripted("S", [{ kind: "compare", i: 0, j: 1 }]), [2, 1], v.it);
  lane.advance(2);
  eq("the end puts out what is still lit", bars(v.calls).slice(-2), [["bar", 0, 2, "sorted"], ["bar", 1, 1, "sorted"]]);
}

{
  const v = mock<BarView>();
  const data = [2, 1];
  new Lane(scripted("S", []), data, v.it).advance();
  eq("a lane leaves the caller's data alone", data, [2, 1]);
}

// Races: lanes of 2, 3 and 3 steps.
const c: Step = { kind: "compare", i: 0, j: 0 };
const lane = (name: string, k: number) => new Lane(scripted(name, Array(k).fill(c)), [1], mock<BarView>().it);
{
  const race = new Race(lane("short", 2), lane("long", 3));
  eq("no winner while both run", race.tick(1), null);
  eq("still none at the last step: the end is the step after", race.tick(1), null);
  const w = race.tick(1);
  eq("the shorter finishes first and wins", w === "tie" ? w : w?.algorithm.name, "short");
  eq("a race is decided once", [race.tick(1), race.finished], [null, true]);
}
{
  const race = new Race(lane("a", 3), lane("b", 3));
  eq("equal work is a tie", race.tick(10), "tie");
}
{
  const race = new Race(lane("a", 3), lane("b", 2));
  const w = race.tick(5);
  eq("both done in one tick: fewer steps wins", w === "tie" ? w : w?.algorithm.name, "b");
}
// expect: ok a new lane draws every bar idle, then zero counts
// expect: ok and has taken no step
// expect: ok a compare lights both bars
// expect: ok the next step puts them out, then a swap lights them at their new heights
// expect: ok the lane's own bars follow
// expect: ok sorted settles a bar
// expect: ok a sorted bar written stays sorted, at its new height
// expect: ok roles so far
// expect: ok the end settles every bar left and reports once
// expect: ok finished
// expect: ok the end puts out what is still lit
// expect: ok a lane leaves the caller's data alone
// expect: ok no winner while both run
// expect: ok still none at the last step: the end is the step after
// expect: ok the shorter finishes first and wins
// expect: ok a race is decided once
// expect: ok equal work is a tie
// expect: ok both done in one tick: fewer steps wins
