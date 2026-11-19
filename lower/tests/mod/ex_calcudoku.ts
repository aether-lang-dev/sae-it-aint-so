// examples/calcudoku's rules, headless: the cases of Tsyne's
// ported-apps/calcudoku/calcudoku.logic.test.ts (Paul Hammant, MIT), run on
// the engine with no window.
import { CalcudokuGame, PUZZLES } from "./examples/calcudoku/lib/calcudoku.ts";
import { eq } from "./lib/check.ts";

const g0 = new CalcudokuGame();
eq("starts at level 0, 3x3, empty, not won, nothing selected", [g0.getLevel(), g0.getSize(), g0.getValue(0), g0.isWon(), g0.getSelected()], [0, 3, 0, false, null]);
eq("five puzzles with cages", [PUZZLES.length, g0.getLevelCount(), g0.getCages().length], [5, 5, 5]);

const nav = new CalcudokuGame();
nav.nextLevel(); nav.nextLevel(); nav.prevLevel();
eq("levels go up and down", nav.getLevel(), 1);
nav.setLevel(0); nav.prevLevel();
eq("prevLevel stops at 0", nav.getLevel(), 0);
for (let i = 0; i < 10; i++) nav.nextLevel();
eq("nextLevel stops at the last", [nav.getLevel(), nav.getSize()], [4, 5]);
nav.selectCell(3); nav.setValue(2); nav.prevLevel();
eq("changing level clears the board and the selection", [nav.getValue(3), nav.getSelected()], [0, null]);

const sel = new CalcudokuGame();
sel.selectCell(4);
eq("select", sel.getSelected(), 4);
sel.selectCell(4);
eq("selecting the same cell deselects", sel.getSelected(), null);
sel.selectCell(4); sel.selectCell(5);
eq("selecting another moves it", sel.getSelected(), 5);

const set = new CalcudokuGame();
set.setValue(2);
eq("setValue without a selection does nothing", set.getValue(0), 0);
set.selectCell(2); set.setValue(2);
eq("setValue sets the selected cell", set.getValue(2), 2);
set.clearCell();
eq("clearCell empties it", set.getValue(2), 0);
set.selectCell(1); set.clearCell();
eq("clearCell on an empty cell is harmless", set.getValue(1), 0);
set.setValue(3); set.reset();
eq("reset clears values and selection", [set.getValue(1), set.getSelected()], [0, null]);

eq("cages: first cell is the top left, every cell is in one", [
  g0.getCageForCell(0)?.target, g0.isCageTopLeft(0), g0.isCageTopLeft(1),
  Array.from({ length: 9 }, (_, i) => g0.getCageForCell(i) !== undefined).every(Boolean),
], [4, true, false, true]);

const val = new CalcudokuGame();
eq("empty board is valid, not full", [val.isValid(), val.isFull()], [true, false]);
val.selectCell(0); val.setValue(1); val.selectCell(1); val.setValue(1);
eq("a duplicate in a row is invalid and both cells are errors", [val.isValid(), [...val.getErrors()].sort()], [false, [0, 1]]);
val.reset(); val.selectCell(0); val.setValue(1); val.selectCell(3); val.setValue(1);
eq("a duplicate in a column is invalid", val.isValid(), false);

const cage = new CalcudokuGame();
cage.selectCell(2); cage.setValue(2);
eq("an equals cage with the right number is valid", [cage.isValid(), cage.getErrors().has(2)], [true, false]);
cage.setValue(3);
eq("and with the wrong one an error", cage.getErrors().has(2), true);
cage.setLevel(2);
for (const [pos, v] of [[1, 2], [2, 3]]) { cage.selectCell(pos); cage.setValue(v); }
eq("a times cage: 2 x 3 makes 6", cage.getErrors().has(1), false);

const win = new CalcudokuGame();
const sol = [1, 3, 2, 3, 2, 1, 2, 1, 3];
sol.forEach((v, i) => win.setCell(i, v));
eq("the known answer wins", [win.isFull(), win.isValid(), win.isWon()], [true, true, true]);
win.setCell(0, 3);
eq("a wrong cell does not", win.isWon(), false);

const sv = new CalcudokuGame();
eq("the solver finds level 1's answer", sv.solve(), sol);
for (let lv = 0; lv < PUZZLES.length; lv++) {
  sv.setLevel(lv);
  const s = sv.solve()!;
  s.forEach((v, i) => sv.setCell(i, v));
  eq(`level ${lv + 1} solves to a win with no zeros`, [s.includes(0), sv.isWon()], [false, true]);
}
// expect: ok starts at level 0, 3x3, empty, not won, nothing selected
// expect: ok five puzzles with cages
// expect: ok levels go up and down
// expect: ok prevLevel stops at 0
// expect: ok nextLevel stops at the last
// expect: ok changing level clears the board and the selection
// expect: ok select
// expect: ok selecting the same cell deselects
// expect: ok selecting another moves it
// expect: ok setValue without a selection does nothing
// expect: ok setValue sets the selected cell
// expect: ok clearCell empties it
// expect: ok clearCell on an empty cell is harmless
// expect: ok reset clears values and selection
// expect: ok cages: first cell is the top left, every cell is in one
// expect: ok empty board is valid, not full
// expect: ok a duplicate in a row is invalid and both cells are errors
// expect: ok a duplicate in a column is invalid
// expect: ok an equals cage with the right number is valid
// expect: ok and with the wrong one an error
// expect: ok a times cage: 2 x 3 makes 6
// expect: ok the known answer wins
// expect: ok a wrong cell does not
// expect: ok the solver finds level 1's answer
// expect: ok level 1 solves to a win with no zeros
// expect: ok level 2 solves to a win with no zeros
// expect: ok level 3 solves to a win with no zeros
// expect: ok level 4 solves to a win with no zeros
// expect: ok level 5 solves to a win with no zeros
