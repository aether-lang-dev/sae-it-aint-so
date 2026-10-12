// What-if and data tools, as Excel's Data tab has them: Goal Seek (vary one
// input until a formula comes to a value: the secant method over the sheet),
// Data Table (a formula worked out for each value of one input, or each pair
// of two, the results written as values), Remove Duplicates, Text to
// Columns. Trials set cells without undo steps; each command is one step.
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { secant, splitText, distinctRows } from "./sheet/whatif.ts";
import { show } from "./sheet/format.ts";
import { eq } from "./lib/check.ts";

eq("secant: a root of a function, from a start", [await secant(async (x) => x * x + 2 * x - 15, 1), await secant(async (x) => x * x + 1, 1)].map((r) => r && Math.round(r.x * 1e9) / 1e9), [3, null]);
eq("text split by a delimiter, quotes kept together", [splitText('x,"a, b",3', ","), splitText("p q  r", " "), splitText("1\t2", "\t")], [["x", "a, b", "3"], ["p", "q", "", "r"], ["1", "2"]]);
eq("rows whose chosen columns repeat an earlier row's, any case", distinctRows([["a", "1"], ["b", "2"], ["A", "1"], ["c", "3"], ["b", "9"]], [0, 1]), [0, 1, 3, 4]);

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
const shown = (...keys: string[]) => keys.map((k) => show(wb.sheet.value(k)));
const set = (cell: string, input: string) => cmds.run(`cell.set cell=${cell} input="${input.replace(/"/g, '""')}"`);

await set("B1", "1");
await set("B2", "=B1*B1+2*B1");
eq("Goal Seek: an input varied until a formula comes to a value", [await message("data.goalSeek set=B2 to=15 by=B1"), shown("B1", "B2")], ["B2 = 15 with B1 = 3", ["3", "15"]]);
eq("one undo takes it back", [(await cmds.run("edit.undo")) && shown("B1", "B2")], [["1", "3"]]);
eq("one it cannot reach, and refusals", [await message("data.goalSeek set=B2 to=-5 by=B1"), shown("B1"), await message("data.goalSeek set=B1 to=3 by=B2"), await message("data.goalSeek set=B2 to=x by=B1")],
  ["B2 cannot reach -5 by changing B1", ["1"], "B1 is not a formula", "x is not a number"]);

await set("A1", "0.05");
await set("A2", "1000");
await set("E1", "=A2*(1+A1)^10");
await set("D2", "0.04");
await set("D3", "0.05");
await set("D4", "0.06");
eq("Data Table, one input down a column: each value tried, the results written", [await message("data.table range=D1:E4 column=A1"), shown("E2", "E3", "E4", "A1")],
  ["filled the data table D1:E4: 3 results", ["1480.244285", "1628.894627", "1790.847697", "0.05"]]);
await set("G1", "=A1*A2");
await set("H1", "10");
await set("I1", "20");
await set("G2", "1");
await set("G3", "2");
eq("two inputs: the row's values in one, the column's in the other", [await message("data.table range=G1:I3 row=A2 column=A1"), shown("H2", "I2", "H3", "I3")],
  ["filled the data table G1:I3: 4 results", ["10", "20", "20", "40"]]);
eq("a table with no formula where it goes", await message("data.table range=D2:E4 column=A1"), "D2:E4 has no formula in its top row");

for (const [k, v] of [["A10", "a"], ["B10", "1"], ["A11", "b"], ["B11", "2"], ["A12", "A"], ["B12", "1"], ["A13", "c"], ["B13", "3"], ["A14", "b"], ["B14", "9"]]) await set(k, v);
eq("Remove Duplicates: by every column", [await message("data.removeDuplicates range=A10:B14"), shown("A12", "A13", "B13", "A14")],
  ["removed 1 duplicate row of A10:B14; 4 left", ["c", "b", "9", ""]]);
eq("by chosen columns", [await message("data.removeDuplicates range=A10:B14 columns=A"), shown("A10", "A11", "A12", "A13")],
  ["removed 1 duplicate row of A10:B14; 4 left", ["a", "b", "c", ""]]);

await set("A16", "x,1,TRUE");
await set("A17", "y,2");
await set("A18", "z");
eq("Text to Columns: split in place, numbers as numbers", [await message("data.textToColumns range=A16:A18"), shown("A16", "B16", "C16", "A17", "B17", "A18"), typeof wb.sheet.value("B16")],
  ["split A16:A18 into 3 columns", ["x", "1", "TRUE", "y", "2", "z"], "number"]);
await set("A19", "p;q");
await set("B19", "taken");
eq("not over cells that hold something, unless told; another delimiter", [await message("data.textToColumns range=A19 delimiter=;"), await message("data.textToColumns range=A19 delimiter=; replace=1"), shown("B19")],
  ["B19 is not empty", "split A19 into 2 columns", ["q"]]);
eq("one column only", await message("data.textToColumns range=A16:B17"), "Text to Columns splits one column");
// expect: ok secant: a root of a function, from a start
// expect: ok text split by a delimiter, quotes kept together
// expect: ok rows whose chosen columns repeat an earlier row's, any case
// expect: ok Goal Seek: an input varied until a formula comes to a value
// expect: ok one undo takes it back
// expect: ok one it cannot reach, and refusals
// expect: ok Data Table, one input down a column: each value tried, the results written
// expect: ok two inputs: the row's values in one, the column's in the other
// expect: ok a table with no formula where it goes
// expect: ok Remove Duplicates: by every column
// expect: ok by chosen columns
// expect: ok Text to Columns: split in place, numbers as numbers
// expect: ok not over cells that hold something, unless told; another delimiter
// expect: ok one column only
