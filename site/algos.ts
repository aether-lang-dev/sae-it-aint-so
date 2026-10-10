// Algorithm theatre (docs/roadmap.md demo 17): two sorting algorithms race on
// the same shuffled bars. Each algorithm is a generator (site/algos/sorts.ts)
// that yields a step before every compare, swap and write; the frame clock
// asks each for a few steps a frame, so a recursive quicksort pauses
// mid-partition because nobody asked it for its next step. The page only
// draws: a Lane (site/algos/lane.ts) decides what each bar is doing and
// tells a BarView, which here is vg.
import { algorithms } from "./algos/sorts.ts";
import { shuffled } from "./algos/random.ts";
import { Lane, Race } from "./algos/lane.ts";
import type { BarView, Role } from "./algos/lane.ts";
import type { Algorithm, Tally } from "./algos/steps.ts";

const { text, btn, toggle, slider, picker, picker_add, hstack } = ui;

const N = 24;                  // bars a lane
const SLOT = 10, BAR = 8;      // viewBox units a bar takes, and draws
const UNIT = 2;                // height per value: the tallest bar is 48
const BASES = [62, 128] as const;
const COLOURS: Readonly<Record<Role, string>> = {
  idle: "#5b8def", compare: "#f5a623", swap: "#e8505b", write: "#b06ee8", sorted: "#4cc38a",
};

const [bubble, insertion, selection, quick, merge] = algorithms;
const matchups: readonly (readonly [Algorithm, Algorithm])[] = [
  [bubble, quick], [insertion, merge], [selection, insertion], [quick, merge],
];

// One lane's bars in the scene, its title, and the label under the scene.
class VgLane implements BarView {
  readonly #rects: number[];
  readonly #title: number;
  readonly #base: number;
  readonly label = state("");
  name = "";

  constructor(rects: number[], title: number, base: number) {
    this.#rects = rects;
    this.#title = title;
    this.#base = base;
  }

  start(name: string): void {
    this.name = name;
    vg.set(this.#title, { text: name });
  }

  bar(i: number, value: number, role: Role): void {
    vg.set(this.#rects[i], { y: this.#base - value * UNIT, h: value * UNIT, fill: COLOURS[role] });
  }

  counts(t: Tally, steps: number): void {
    this.label.set(`${this.name}: step ${steps}, ${t}`);
  }

  done(t: Tally, steps: number): void {
    this.label.set(`${this.name}: done in ${steps} steps, ${t}`);
    print(`algos: ${this.name} done: ${steps} steps, ${t}`);
  }
}

let seed = 7;
let matchup = 0;
let speed = 2;                 // steps a frame for each lane
let running = false;
let race: Race | null = null;
const verdict = state("");
const views: VgLane[] = [];

const load = () => {
  const data = shuffled(N, seed);
  const [a, b] = matchups[matchup];
  batch(() => {
    const lanes = [a, b].map((algo, k) => {
      views[k].start(algo.name);
      return new Lane(algo, data, views[k]);
    });
    race = new Race(...lanes);
    verdict.set(`${a.name} vs ${b.name}, seed ${seed}`);
  });
  print(`algos: ${a.name} vs ${b.name} on seed ${seed}`);
};

const advance = (n: number) => {
  if (!race || race.finished) return;
  batch(() => {
    const won = race!.tick(n);
    if (won === "tie") verdict.set("A dead heat");
    else if (won) verdict.set(`${won.algorithm.name} wins in ${won.steps} steps`);
    if (won) print(`algos: ${won === "tie" ? "tie" : `${won.algorithm.name} wins`}`);
  });
};

text("Algorithm theatre");
vg.scene(`0 0 ${N * SLOT} ${BASES[1] + 2}`, 480, 260, () => {
  vg.rect(0, 0, N * SLOT, BASES[1] + 2, () => vg.fill("#14161c"));
  for (const base of BASES) {
    const title = vg.text_sized(2, base - 52, 6, "", () => vg.fill("#c8ccd4"));
    const rects = Array.from({ length: N }, (_, i) =>
      vg.rect(i * SLOT + (SLOT - BAR) / 2, base - N * UNIT, BAR, N * UNIT, () => vg.fill(COLOURS.idle)));
    views.push(new VgLane(rects, title, base));
  }
});
for (const v of views) bind(text(""), v.label);
bind(text(""), verdict);

hstack(() => {
  btn("Step", () => advance(1));
  toggle("Run", (on: boolean) => { running = on; });
  btn("Shuffle", () => { seed++; load(); });
});
slider(1, 32, speed, (v: number) => { speed = Math.max(1, Math.round(v)); });
const choose = picker((i: number) => { matchup = i; load(); });
for (const [a, b] of matchups) picker_add(choose, `${a.name} vs ${b.name}`);
btn("Home", () => browserContext.changePage("/"));
load();

// The frame clock: `speed` steps a lane each frame while Run is on.
const tick = () => {
  if (running) advance(speed);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
