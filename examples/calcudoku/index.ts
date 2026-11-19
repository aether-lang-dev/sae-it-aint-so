// SPDX-License-Identifier: MIT
// Calcudoku (KenKen), as a sae app. Ported from Tsyne's ported-apps/calcudoku
// (MIT, portions copyright Paul Hammant 2026; see NOTICE.md): fill the grid
// with 1 to N, each row and column once, each cage's numbers making its
// target with its operation. The rules, the five puzzles and the solver are
// Tsyne's (lib/calcudoku.ts); the board is a vg scene, its cells clickable.
import { CalcudokuGame } from "./lib/calcudoku.ts";

const { vstack, hstack, text, btn, divider, clear, into, timer, timer_cancel, state, bind, on_key } = ui;
const { scene, g, rect, text_anchored, fill, stroke, on_click } = vg;

const CELL = 55;
const game = new CalcudokuGame();
const status = state("");
const levelText = state("");

let sceneH = 0;
let boardG = 0;
let cellFill: number[] = [];
let cellVal: number[] = [];
let solveTimer = 0;
let solving = false;
let announced = false;

const levelLabel = (): string => `Level ${game.getLevel() + 1}/${game.getLevelCount()}`;

const refresh = (): void => {
  const size = game.getSize();
  const total = size * size;
  const errors = game.getErrors();
  const selected = game.getSelected();
  let filled = 0;
  for (let i = 0; i < total; i++) {
    const v = game.getValue(i);
    if (v > 0) filled++;
    vg.set_text(cellVal[i], v > 0 ? String(v) : "");
    vg.set_fill(cellFill[i], i === selected ? "#E3F2FD" : errors.has(i) ? "#FFEBEE" : "#FFFFFF");
  }
  levelText.set(levelLabel());
  if (game.isWon()) {
    status.set("Solved!");
    if (!announced) { announced = true; print(`calcudoku: solved level ${game.getLevel() + 1}`); }
  } else {
    status.set(`${filled}/${total} cells`);
  }
};

const drawBoard = (): void => {
  const size = game.getSize();
  const px = size * CELL;
  vg.set_view_box(sceneH, `0 0 ${px} ${px}`);
  vg.resize(sceneH, px, px);
  if (boardG) vg.remove(boardG);
  cellFill = [];
  cellVal = [];
  vg.into(sceneH, () => {
    boardG = g(() => {
      for (let i = 0; i < size * size; i++) {
        const x = (i % size) * CELL, y = Math.floor(i / size) * CELL;
        const cage = game.getCageForCell(i);
        // on_click belongs to a shape's own block, so each shape of the cell has one
        const pick = () => on_click(() => { game.selectCell(i); refresh(); });
        g(() => {
          cellFill[i] = rect(x + 1, y + 1, CELL - 2, CELL - 2, () => { fill("#FFFFFF"); stroke("#333333", 2); pick(); });
          if (cage && game.isCageTopLeft(i)) {
            text_anchored(x + 5, y + 14, 12, "start", `${cage.target}${cage.op}`, () => { fill("#666666"); pick(); });
          }
          cellVal[i] = text_anchored(x + CELL / 2, y + CELL / 2 + 14, 28, "middle", "", () => { fill("#222222"); pick(); });
        });
      }
    });
  });
};

let numRow = 0;
const drawNumbers = (): void => {
  clear(numRow);
  into(numRow, () => {
    for (let n = 1; n <= game.getSize(); n++) btn(String(n), () => enter(n));
    btn("C", () => { game.clearCell(); refresh(); });
  });
};

const enter = (n: number): void => {
  game.setValue(n);
  refresh();
};

const newLevel = (level: number): void => {
  stopSolve();
  announced = false;
  game.setLevel(level);
  drawBoard();
  drawNumbers();
  refresh();
};

const stopSolve = (): void => {
  if (solveTimer) timer_cancel(solveTimer);
  solveTimer = 0;
  solving = false;
};

// Solve: clear the board and let the solver's answer arrive a cell at a
// time, as Tsyne's visibleSolve does (150 ms apart).
const visibleSolve = (): void => {
  if (solving) return;
  const solution = game.solve();
  if (!solution) return;
  solving = true;
  announced = false;
  game.reset();
  refresh();
  let i = 0;
  solveTimer = timer(150, () => {
    game.setCell(i, solution[i]);
    i++;
    refresh();
    if (i >= solution.length) stopSolve();
  });
};

hstack(4, () => {
  btn("Reset", () => { stopSolve(); announced = false; game.reset(); refresh(); });
  btn("Solve", visibleSolve);
  btn("<", () => newLevel(game.getLevel() - 1));
  bind(text(""), levelText);
  btn(">", () => newLevel(game.getLevel() + 1));
});
divider();
sceneH = scene("0 0 165 165", 165, 165);
divider();
numRow = hstack(4);
divider();
bind(text(""), status);

on_key((key: string) => {
  if (key.length === 1 && key >= "1" && key <= "9" && Number(key) <= game.getSize()) enter(Number(key));
  else if (key === "BackSpace" || key === "Delete" || key === "0") { game.clearCell(); refresh(); }
});

newLevel(0);
