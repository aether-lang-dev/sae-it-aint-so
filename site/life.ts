// Life (docs/roadmap.md demo 14): Conway's Game of Life on a vg.raster, run
// on the frame clock, click a cell to toggle it, patterns from a picker, the
// generation count bound to a label. A Game of Life; Tsyne
// `ported-apps/game-of-life`-alike as an idea only; written fresh.
const { text, btn, toggle, picker, picker_add, ui_state, ui_set, text_bound } = ui;

const N = 64;                       // cells a side, one raster pixel each
let cells = new Uint8Array(N * N);
let next = new Uint8Array(N * N);
const px = new Uint8Array(N * N * 4);
let generation = 0;
let running = false;
let raster = 0;
const gen = ui_state(0);

const paint = () => {
  for (let i = 0; i < N * N; i++) {
    const o = i * 4;
    const alive = cells[i] === 1;
    px[o] = alive ? 90 : 18; px[o + 1] = alive ? 220 : 22; px[o + 2] = alive ? 120 : 30; px[o + 3] = 255;
  }
  if (raster) vg.raster_update(raster, px);
};

const step = () => {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          n += cells[((y + dy + N) % N) * N + ((x + dx + N) % N)];
        }
      }
      const i = y * N + x;
      next[i] = (n === 3 || (n === 2 && cells[i] === 1)) ? 1 : 0;
    }
  }
  [cells, next] = [next, cells];
  generation++;
  ui_set(gen, generation);
  paint();
};

const patterns: [string, [number, number][]][] = [
  ["Blinker", [[31, 32], [32, 32], [33, 32]]],
  ["Glider", [[2, 1], [3, 2], [1, 3], [2, 3], [3, 3]]],
  ["R-pentomino", [[32, 31], [33, 31], [31, 32], [32, 32], [32, 33]]],
  ["Empty", []],
];
const load = (i: number) => {
  cells.fill(0);
  for (const [x, y] of patterns[i][1]) cells[y * N + x] = 1;
  generation = 0;
  ui_set(gen, 0);
  paint();
  print(`life: ${patterns[i][0]} loaded`);
};

text("Life");
load(0);
vg.scene(`0 0 ${N} ${N}`, 384, 384, () => {
  raster = vg.raster(N, N, px, () => {
    vg.on_click((x: number, y: number) => {
      const cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) return;
      const i = cy * N + cx;
      cells[i] = cells[i] === 1 ? 0 : 1;
      paint();
      print(`life: cell ${cx},${cy} ${cells[i] === 1 ? "born" : "died"}`);
    });
  });
});
text_bound(gen, "Generation ", "");
btn("Step", step);
toggle("Run", (on: boolean) => { running = on; });
const choose = picker((i: number) => load(i));
for (const [name] of patterns) picker_add(choose, name);
btn("Home", () => browserContext.changePage("/"));

// The frame clock: a generation every 6 frames while Run is on.
let frames = 0;
const tick = () => {
  if (running && ++frames % 6 === 0) step();
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
