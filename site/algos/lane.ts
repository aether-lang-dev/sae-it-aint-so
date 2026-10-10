// One algorithm on one row of bars. A Lane replays its algorithm's steps on
// its own copy of the bars, decides each bar's role (the bars just compared,
// swapped or written light up for one step; a bar in its final place stays
// sorted), and tells a BarView. It never draws: the page's view does that
// with vg, a test's with a recording.
import { apply, Tally, unreachable } from "./steps.ts";
import type { Algorithm, Step } from "./steps.ts";
import { Runner } from "./runner.ts";
import type { Listener } from "./runner.ts";

export type Role = "idle" | "compare" | "swap" | "write" | "sorted";

export interface BarView {
  bar(i: number, value: number, role: Role): void;
  counts(tally: Tally, steps: number): void;
  done(tally: Tally, steps: number): void;
}

export class Lane implements Listener<Step> {
  readonly algorithm: Algorithm;
  readonly tally = new Tally();
  readonly #bars: number[];
  readonly #roles: Role[];
  readonly #view: BarView;
  readonly #runner: Runner<Step>;
  #lit: number[] = [];

  constructor(algorithm: Algorithm, data: readonly number[], view: BarView) {
    this.algorithm = algorithm;
    this.#bars = [...data];
    this.#roles = data.map((): Role => "idle");
    this.#view = view;
    this.#runner = new Runner(algorithm.sort([...data]), this);
    this.#bars.forEach((v, i) => view.bar(i, v, "idle"));
    view.counts(this.tally, 0);
  }

  get bars(): readonly number[] { return this.#bars; }
  get roles(): readonly Role[] { return this.#roles; }
  get steps(): number { return this.#runner.steps; }
  get finished(): boolean { return this.#runner.finished; }

  advance(n = 1): number { return this.#runner.advance(n); }

  step(s: Step, n: number): void {
    this.#unlight();
    apply(this.#bars, s);
    this.tally.count(s);
    switch (s.kind) {
      case "compare": this.#light("compare", s.i, s.j); break;
      case "swap": this.#light("swap", s.i, s.j); break;
      case "write": this.#light("write", s.i); break;
      case "sorted": this.#settle(s.i); break;
      default: unreachable(s);
    }
    this.#view.counts(this.tally, n);
  }

  done(steps: number): void {
    this.#unlight();
    this.#roles.forEach((role, i) => { if (role !== "sorted") this.#settle(i); });
    this.#view.done(this.tally, steps);
  }

  #light(role: Role, ...at: number[]): void {
    for (const i of at) {
      if (this.#roles[i] !== "sorted") {
        this.#roles[i] = role;
        this.#lit.push(i);
      }
      this.#view.bar(i, this.#bars[i], this.#roles[i]);
    }
  }

  #unlight(): void {
    for (const i of this.#lit) {
      if (this.#roles[i] === "sorted") continue;
      this.#roles[i] = "idle";
      this.#view.bar(i, this.#bars[i], "idle");
    }
    this.#lit = [];
  }

  #settle(i: number): void {
    this.#roles[i] = "sorted";
    this.#view.bar(i, this.#bars[i], "sorted");
  }
}

// Lanes advanced together, the same number of steps a tick: the one that
// needs fewest steps finishes first.
export class Race {
  readonly lanes: readonly Lane[];
  #decided = false;

  constructor(...lanes: Lane[]) {
    this.lanes = lanes;
  }

  get finished(): boolean { return this.lanes.every((l) => l.finished); }

  // Advance every lane still running by `n`. Returns the winner (or "tie")
  // on the tick it is decided, null on every other.
  tick(n = 1): Lane | "tie" | null {
    for (const lane of this.lanes) if (!lane.finished) lane.advance(n);
    if (this.#decided) return null;
    const done = this.lanes.filter((l) => l.finished);
    if (done.length === 0) return null;
    this.#decided = true;
    const best = Math.min(...done.map((l) => l.steps));
    const first = done.filter((l) => l.steps === best);
    return first.length === 1 ? first[0] : "tie";
  }
}
