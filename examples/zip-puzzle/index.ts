// SPDX-License-Identifier: MIT
// Zip Puzzle, as a sae app. Ported from Tsyne's ported-apps/zip-puzzle (MIT,
// portions copyright Paul Hammant 2026; see NOTICE.md): draw one path from
// waypoint 1 through the numbers in order, visiting every cell once. Click
// a neighbour of the head to extend the path; click the head, or an earlier
// cell, to take it back. The rules and the five puzzles are Tsyne's
// (lib/zip-puzzle.ts); the board is a vg scene.
import { ZipPuzzleGame } from "./lib/zip-puzzle.ts";

const { hstack, text, btn, divider, state, bind } = ui;
const { scene, g, rect, text_anchored, fill, stroke, on_click } = vg;

const CELL = 50;
const PITCH = 52;
const game = new ZipPuzzleGame();
const status = state("");
const levelText = state("");

let sceneH = 0;
let boardG = 0;
let cellFill: number[] = [];
let announced = false;

const refresh = (): void => {
  const total = game.getSize() ** 2;
  for (let i = 0; i < total; i++) {
    const wp = game.getWaypoint(i);
    const inPath = game.isInPath(i);
    let c = "#F0F0F0";
    if (wp) c = inPath ? "#228B22" : "#333333";
    else if (inPath) c = game.isHead(i) ? "#90EE90" : "#98FB98";
    vg.set_fill(cellFill[i], c);
  }
  levelText.set(`Level ${game.getLevel() + 1}/${game.getLevelCount()}`);
  if (game.isWon()) {
    status.set("Solved!");
    if (!announced) { announced = true; print(`zip: solved level ${game.getLevel() + 1}`); }
  } else {
    status.set(`${game.getPath().length}/${total} cells`);
  }
};

const drawBoard = (): void => {
  const size = game.getSize();
  const px = size * PITCH - 2;
  vg.set_view_box(sceneH, `0 0 ${px} ${px}`);
  vg.resize(sceneH, px, px);
  if (boardG) vg.remove(boardG);
  cellFill = [];
  vg.into(sceneH, () => {
    boardG = g(() => {
      for (let i = 0; i < size * size; i++) {
        const x = (i % size) * PITCH, y = Math.floor(i / size) * PITCH;
        const click = () => on_click(() => { game.tryClick(i); refresh(); });
        cellFill[i] = rect(x, y, CELL, CELL, () => { fill("#F0F0F0"); stroke("#CCCCCC", 1); click(); });
        const wp = game.getWaypoint(i);
        if (wp) text_anchored(x + CELL / 2, y + CELL / 2 + 8, 24, "middle", String(wp), () => { fill("#FFFFFF"); click(); });
      }
    });
  });
};

const newLevel = (level: number): void => {
  announced = false;
  game.setLevel(level);
  drawBoard();
  refresh();
};

hstack(4, () => {
  btn("Reset", () => { announced = false; game.reset(); refresh(); });
  btn("<", () => newLevel(game.getLevel() - 1));
  bind(text(""), levelText);
  btn(">", () => newLevel(game.getLevel() + 1));
});
divider();
sceneH = scene("0 0 258 258", 258, 258);
divider();
bind(text(""), status);

newLevel(0);
