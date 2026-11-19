// examples/zip-puzzle's rules, headless: the cases of Tsyne's
// ported-apps/zip-puzzle/zip-puzzle.logic.test.ts (Paul Hammant, MIT).
import { ZipPuzzleGame, PUZZLES } from "./examples/zip-puzzle/lib/zip-puzzle.ts";
import { eq } from "./lib/check.ts";

const g0 = new ZipPuzzleGame();
eq("starts at level 0, 5x5, five puzzles, not won", [g0.getLevel(), g0.getSize(), PUZZLES.length, g0.getLevelCount(), g0.isWon()], [0, 5, 5, 5, false]);
eq("the path starts at waypoint 1, which is the head", [[...g0.getPath()], g0.isInPath(0), g0.isHead(0), g0.getWaypoint(0), g0.getWaypoint(4), g0.getWaypoint(1)], [[0], true, true, 1, 2, undefined]);

const nav = new ZipPuzzleGame();
nav.nextLevel(); nav.nextLevel(); nav.prevLevel();
eq("levels go up and down", nav.getLevel(), 1);
nav.setLevel(0); nav.prevLevel();
eq("prevLevel stops at 0", nav.getLevel(), 0);
for (let i = 0; i < 10; i++) nav.nextLevel();
eq("nextLevel stops at the last: 7x7", [nav.getLevel(), nav.getSize()], [4, 7]);
nav.setLevel(0); nav.tryClick(1); nav.setLevel(1);
eq("changing level resets the path", [...nav.getPath()], [0]);

const p = new ZipPuzzleGame();
p.tryClick(1);
eq("the path extends to an adjacent cell, which is now the head", [[...p.getPath()], p.isHead(1), p.isHead(0)], [[0, 1], true, false]);
p.tryClick(7);
eq("not to a cell that is not adjacent (a diagonal)", [...p.getPath()], [0, 1]);
p.tryClick(3);
eq("nor to one two away", [...p.getPath()], [0, 1]);
p.tryClick(2); p.tryClick(1);
eq("clicking the head's predecessor takes the head back to it", [...p.getPath()], [0, 1]);
p.tryClick(2); p.tryClick(2);
eq("clicking the head undoes one move", [...p.getPath()], [0, 1]);
p.tryClick(2); p.tryClick(0);
eq("clicking an earlier cell cuts the path back to it", [...p.getPath()], [0]);
p.tryClick(0);
eq("the start cannot be undone", [...p.getPath()], [0]);
p.tryClick(1); p.tryClick(6); p.tryClick(5);
eq("a cell already in the path cannot be revisited", [...p.getPath()].length, 4);
eq("path indexes", [p.getPathIndex(6), p.getPathIndex(24)], [2, -1]);

const w = new ZipPuzzleGame();
w.setLevel(1);
for (const c of [1, 6, 5, 10]) w.tryClick(c);
w.tryClick(2);
eq("level 2: waypoint 2 is cell 2; from cell 10 it is not adjacent, so refused", [...w.getPath()], [0, 1, 6, 5, 10]);
const o = new ZipPuzzleGame();
o.setLevel(1);
o.tryClick(1); o.tryClick(2);
eq("waypoint 2 is taken when the head is next to it", [...o.getPath()], [0, 1, 2]);
const ooo = new ZipPuzzleGame();
ooo.setLevel(1);
for (const c of [5, 10, 11, 12]) ooo.tryClick(c);
eq("waypoint 3 (cell 12) before waypoint 2 is refused", [...ooo.getPath()], [0, 5, 10, 11]);

const rs = new ZipPuzzleGame();
rs.tryClick(1); rs.tryClick(2); rs.reset();
eq("reset restores the start", [...rs.getPath()], [0]);
eq("an incomplete path does not win", rs.isWon(), false);

// a snake through every cell of level 1 wins: across row 0 (through 2 at cell
// 4), back along row 1, and so on, ending on 3 at cell 24
const win = new ZipPuzzleGame();
const snake: number[] = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) snake.push(r * 5 + (r % 2 === 0 ? c : 4 - c));
snake.slice(1).forEach((c) => win.tryClick(c));
eq("the snake visits all 25 cells in order and wins", [win.getPath().length, win.isWon()], [25, true]);
const short = new ZipPuzzleGame();
snake.slice(1, 24).forEach((c) => short.tryClick(c));
eq("one cell short does not", short.isWon(), false);
// expect: ok starts at level 0, 5x5, five puzzles, not won
// expect: ok the path starts at waypoint 1, which is the head
// expect: ok levels go up and down
// expect: ok prevLevel stops at 0
// expect: ok nextLevel stops at the last: 7x7
// expect: ok changing level resets the path
// expect: ok the path extends to an adjacent cell, which is now the head
// expect: ok not to a cell that is not adjacent (a diagonal)
// expect: ok nor to one two away
// expect: ok clicking the head's predecessor takes the head back to it
// expect: ok clicking the head undoes one move
// expect: ok clicking an earlier cell cuts the path back to it
// expect: ok the start cannot be undone
// expect: ok a cell already in the path cannot be revisited
// expect: ok path indexes
// expect: ok level 2: waypoint 2 is cell 2; from cell 10 it is not adjacent, so refused
// expect: ok waypoint 2 is taken when the head is next to it
// expect: ok waypoint 3 (cell 12) before waypoint 2 is refused
// expect: ok reset restores the start
// expect: ok an incomplete path does not win
// expect: ok the snake visits all 25 cells in order and wins
// expect: ok one cell short does not
