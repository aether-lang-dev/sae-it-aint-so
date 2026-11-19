// examples/tango-puzzle's rules, headless: the cases of Tsyne's
// ported-apps/tango-puzzle/tango-puzzle.logic.test.ts (Paul Hammant, MIT).
import { TangoPuzzleGame, PUZZLES } from "./examples/tango-puzzle/lib/tango-puzzle.ts";
import { eq } from "./lib/check.ts";

const set = (g: TangoPuzzleGame, pos: number, v: string) => {
  while (g.getValue(pos) !== v) g.tryClick(pos);
};
const cells = (g: TangoPuzzleGame) => Array.from({ length: g.getSize() ** 2 }, (_, i) => g.getValue(i));

const g0 = new TangoPuzzleGame();
eq("starts at level 0, 4x4, not won, nothing to undo", [g0.getLevel(), g0.getSize(), g0.isWon(), g0.canUndo(), PUZZLES.length, g0.getLevelCount()], [0, 4, false, false, 5, 5]);
eq("the givens are in place, the rest empty", [g0.getValue(0), g0.getValue(5), g0.getValue(10), g0.getValue(15), g0.getValue(1), g0.isGiven(0), g0.isGiven(1)], ["sun", "moon", "sun", "moon", "empty", true, false]);

const nav = new TangoPuzzleGame();
nav.nextLevel(); nav.nextLevel(); nav.prevLevel();
eq("levels go up and down", nav.getLevel(), 1);
nav.setLevel(0); nav.prevLevel();
eq("prevLevel stops at 0", nav.getLevel(), 0);
for (let i = 0; i < 10; i++) nav.nextLevel();
eq("nextLevel stops at the last: 6x6", [nav.getLevel(), nav.getSize()], [4, 6]);
nav.tryClick(2); nav.prevLevel();
eq("changing level resets the board", [nav.getValue(2), nav.canUndo()], ["empty", false]);

const c = new TangoPuzzleGame();
c.tryClick(1);
eq("a click on empty gives a sun", c.getValue(1), "sun");
c.tryClick(1);
eq("then a moon", c.getValue(1), "moon");
c.tryClick(1);
eq("then empty", c.getValue(1), "empty");
c.tryClick(0);
eq("a given cannot be clicked", [c.getValue(0), c.canUndo()], ["sun", true]);

const u = new TangoPuzzleGame();
u.tryClick(2); u.tryClick(3);
u.undo();
eq("undo restores the previous board", [u.getValue(2), u.getValue(3), u.canUndo()], ["sun", "empty", true]);
u.undo(); u.undo();
eq("undo on an empty stack does nothing", [u.getValue(2), u.canUndo()], ["empty", false]);

const v = new TangoPuzzleGame();
eq("the empty board is valid, not full, without errors", [v.isValid(), v.isFull(), v.getErrors().size], [true, false, 0]);
set(v, 1, "sun");
// row 0 is sun, sun, empty, empty; a third sun makes a triple
set(v, 2, "sun");
eq("three suns in a row are an error, and the row is over half suns besides", [v.isValid(), [...v.getErrors()].sort((a, b) => a - b)], [false, [0, 1, 2, 3]]);
const tc = new TangoPuzzleGame();
set(tc, 4, "sun"); set(tc, 8, "sun");
eq("three in a column too", [...tc.getErrors()].sort((a, b) => a - b), [0, 4, 8, 12]);
const bal = new TangoPuzzleGame();
set(bal, 3, "sun"); set(bal, 1, "moon");
eq("a sun and a moon among givens: no error yet", [bal.isValid(), [...bal.getErrors()].sort((a, b) => a - b)], [true, []]);
set(bal, 2, "sun");
eq("a third sun in a row of four is over the balance", bal.isValid(), false);

const w = new TangoPuzzleGame();
const answer = ["sun", "sun", "moon", "moon", "sun", "moon", "moon", "sun", "moon", "moon", "sun", "sun", "moon", "sun", "sun", "moon"];
answer.forEach((a, i) => set(w, i, a));
eq("a balanced board without triples wins", [w.isFull(), w.isValid(), w.isWon(), w.getErrors().size], [true, true, true, 0]);
set(w, 1, "moon");
eq("one wrong cell and it does not", w.isWon(), false);
w.reset();
eq("reset puts the givens back", [cells(w).filter((x) => x !== "empty").length, w.canUndo()], [4, false]);

// every level has a solution (found by trying, so the puzzles are playable)
const solvable = (lv: number): boolean => {
  const g = new TangoPuzzleGame();
  g.setLevel(lv);
  const n = g.getSize();
  const b: string[] = cells(g);
  const place = (i: number): boolean => {
    if (i === n * n) { for (let k = 0; k < n * n; k++) set(g, k, b[k]); return g.isWon(); }
    if (g.isGiven(i)) return place(i + 1);
    for (const val of ["sun", "moon"]) {
      b[i] = val;
      const r = Math.floor(i / n), col = i % n;
      const row = b.slice(r * n, r * n + col + 1), cl = Array.from({ length: r + 1 }, (_, k) => b[k * n + col]);
      const ok = (line: string[]) => !(line.length >= 3 && line[line.length - 1] === line[line.length - 2] && line[line.length - 2] === line[line.length - 3]);
      if (ok(row) && ok(cl) && place(i + 1)) return true;
    }
    b[i] = "empty";
    return false;
  };
  return place(0);
};
eq("every level can be won", PUZZLES.map((_, i) => solvable(i)), [true, true, true, true, true]);
// expect: ok starts at level 0, 4x4, not won, nothing to undo
// expect: ok the givens are in place, the rest empty
// expect: ok levels go up and down
// expect: ok prevLevel stops at 0
// expect: ok nextLevel stops at the last: 6x6
// expect: ok changing level resets the board
// expect: ok a click on empty gives a sun
// expect: ok then a moon
// expect: ok then empty
// expect: ok a given cannot be clicked
// expect: ok undo restores the previous board
// expect: ok undo on an empty stack does nothing
// expect: ok the empty board is valid, not full, without errors
// expect: ok three suns in a row are an error, and the row is over half suns besides
// expect: ok three in a column too
// expect: ok a sun and a moon among givens: no error yet
// expect: ok a third sun in a row of four is over the balance
// expect: ok a balanced board without triples wins
// expect: ok one wrong cell and it does not
// expect: ok reset puts the givens back
// expect: InternalError: out of memory (the runtime's memory limit)
