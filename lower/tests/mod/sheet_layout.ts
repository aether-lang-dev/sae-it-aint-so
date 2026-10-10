// site/sheet/layout.ts: column edges as widths change, widths held to their
// limits, what cell is under a point, and the room text gets.
import { Columns, HEAD, MAX_WIDTH, MIN_WIDTH, PAD, ROW, ROW_HEAD, START_WIDTH, cellAt, fitted, height, room, rowTop } from "./sheet/layout.ts";
import { eq } from "./lib/check.ts";

const cols = new Columns();
eq("ten columns, all the starting width", [cols.count, cols.widths.every((w) => w === START_WIDTH)], [10, true]);
eq("edges add up from the row numbers", [cols.left(0), cols.left(1), cols.right(9), cols.total], [ROW_HEAD, ROW_HEAD + 70, ROW_HEAD + 700, ROW_HEAD + 700]);
eq("the grid's height", [height, rowTop(0), rowTop(19)], [HEAD + 20 * ROW, HEAD, HEAD + 19 * ROW]);

eq("a resize sets one width, rounded", cols.resize(1, 100.4), 100);
eq("and moves every edge after it", [cols.left(1), cols.left(2), cols.total], [ROW_HEAD + 70, ROW_HEAD + 170, ROW_HEAD + 730]);
eq("widths are held to their limits", [cols.resize(2, 3), cols.resize(3, 9999)], [MIN_WIDTH, MAX_WIDTH]);

const c = new Columns();
eq("the column under x", [c.at(0), c.at(ROW_HEAD), c.at(ROW_HEAD + 69), c.at(ROW_HEAD + 70), c.at(ROW_HEAD + 700)], [null, 0, 0, 1, null]);
eq("the cell under a point", [cellAt(c, 40, HEAD + 1), cellAt(c, 40 + 70 * 2, HEAD + ROW * 3 + 5), cellAt(c, ROW_HEAD + 699, height - 1)], [
  { col: 0, row: 0 }, { col: 2, row: 3 }, { col: 9, row: 19 },
]);
eq("headers and outside are no cell", [cellAt(c, 40, HEAD - 1), cellAt(c, 10, 40), cellAt(c, 40, height), cellAt(c, 900, 40)], [null, null, null, null]);
c.resize(0, 170);
eq("after a resize, a point further right is still in the widened column", cellAt(c, ROW_HEAD + 150, HEAD + 1), { col: 0, row: 0 });

eq("text's room is the width less padding each side", [room(70), room(MIN_WIDTH), room(PAD)], [70 - 2 * PAD, MIN_WIDTH - 2 * PAD, 0]);
eq("a fitted column takes its widest text, rounded up, plus padding", fitted([31.2, 64.4, 0]), 65 + 2 * PAD);
eq("an empty column fits at its padding", [fitted([]), fitted([0])], [2 * PAD, 2 * PAD]);
const f = new Columns();
eq("and resize holds a fitted width to the limits", [f.resize(0, fitted([])), f.resize(1, fitted([900]))], [MIN_WIDTH, MAX_WIDTH]);
// expect: ok ten columns, all the starting width
// expect: ok edges add up from the row numbers
// expect: ok the grid's height
// expect: ok a resize sets one width, rounded
// expect: ok and moves every edge after it
// expect: ok widths are held to their limits
// expect: ok the column under x
// expect: ok the cell under a point
// expect: ok headers and outside are no cell
// expect: ok after a resize, a point further right is still in the widened column
// expect: ok text's room is the width less padding each side
// expect: ok a fitted column takes its widest text, rounded up, plus padding
// expect: ok an empty column fits at its padding
// expect: ok and resize holds a fitted width to the limits
