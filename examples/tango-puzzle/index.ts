// SPDX-License-Identifier: MIT
// Tango Puzzle, as a sae app. Ported from Tsyne's ported-apps/tango-puzzle
// (MIT, portions copyright Paul Hammant 2026; see NOTICE.md): fill the grid
// with suns and moons, no three in a row the same, each row and column half
// of each. Click a cell to cycle empty, sun, moon. The rules, the five
// puzzles and the undo stack are Tsyne's (lib/tango-puzzle.ts); the board is
// a vg scene, the sun and the moon drawn as shapes (Tsyne's app icon's).
import { TangoPuzzleGame } from "./lib/tango-puzzle.ts";

const { hstack, text, btn, divider, state, bind, on_key } = ui;
const { scene, g, rect, circle, path, fill, stroke, on_click, transform } = vg;

const CELL = 55;
const GAP = 3;
const PITCH = CELL + GAP;
const game = new TangoPuzzleGame();
const status = state("");
const levelText = state("");

let sceneH = 0;
let boardG = 0;
let cellFill: number[] = [];
let sunH: number[] = [];
let moonH: number[] = [];
let announced = false;

const refresh = (): void => {
  const size = game.getSize();
  const total = size * size;
  const errors = game.getErrors();
  let filled = 0;
  for (let i = 0; i < total; i++) {
    const v = game.getValue(i);
    const given = game.isGiven(i);
    const bad = errors.has(i);
    if (v !== "empty") filled++;
    vg.set_visible(sunH[i], v === "sun");
    vg.set_visible(moonH[i], v === "moon");
    vg.set_fill(cellFill[i],
      v === "sun" ? (bad ? "#FFCCCC" : given ? "#FFF3E0" : "#FFFDE7")
      : v === "moon" ? (bad ? "#FFCCCC" : given ? "#E3F2FD" : "#F0F8FF")
      : "#F5F5F0");
  }
  levelText.set(`Level ${game.getLevel() + 1}/${game.getLevelCount()}`);
  if (game.isWon()) {
    status.set("Solved!");
    if (!announced) { announced = true; print(`tango: solved level ${game.getLevel() + 1}`); }
  } else if (errors.size > 0) {
    status.set("Rule violation detected");
  } else {
    status.set(`${filled}/${total} cells filled`);
  }
};

const drawBoard = (): void => {
  const size = game.getSize();
  const px = size * PITCH - GAP;
  vg.set_view_box(sceneH, `0 0 ${px} ${px}`);
  vg.resize(sceneH, px, px);
  if (boardG) vg.remove(boardG);
  cellFill = []; sunH = []; moonH = [];
  vg.into(sceneH) {
    boardG = g {
      for (let i = 0; i < size * size; i++) {
        const x = (i % size) * PITCH, y = Math.floor(i / size) * PITCH;
        const click = () => on_click(() => { game.tryClick(i); refresh(); });
        cellFill[i] = rect(x, y, CELL, CELL) { fill("#F5F5F0"); stroke("#DDDDDD", 1); click() };
        sunH[i] = circle(x + CELL / 2, y + CELL / 2, 16) { fill("#F5A623"); click() };
        // Tsyne's icon moon (a 12 by 12 crescent), scaled to the cell
        moonH[i] = path("M16 4a6 6 0 1 0 0 12 5 5 0 1 1 0-12z") {
          fill("#4A90D9");
          transform(`translate(${x + 8} ${y + 8}) scale(3)`);
          click();
        };
      }
    };
  }
};

const newLevel = (level: number): void => {
  announced = false;
  game.setLevel(level);
  drawBoard();
  refresh();
};

hstack(4) {
  btn("Reset", () => { announced = false; game.reset(); refresh(); });
  btn("Undo", () => { game.undo(); refresh(); });
  btn("<", () => newLevel(game.getLevel() - 1));
  bind(text(""), levelText);
  btn(">", () => newLevel(game.getLevel() + 1));
}
divider();
sceneH = scene("0 0 225 225", 225, 225);
divider();
bind(text(""), status);

on_key((key: string) => {
  if (key === "z" || key === "u") { game.undo(); refresh(); }
});

newLevel(0);
