// site/sheet/validation.ts and its commands: a cell's rule for what may be
// typed into it (a list, whole numbers, decimals, a text length; stop or
// warn; always, on create or on update, as the Tauri app's rules have it),
// checked by cell.set, and Circle Invalid for what breaks one.
import { check, limitsOf, ruleOf } from "./sheet/validation.ts";
import { Commands } from "./sheet/commands.ts";
import { Workbook } from "./sheet/workbook.ts";
import { eq, throws } from "./lib/check.ts";

const whole = ruleOf({ kind: "whole", min: "1", max: "10" });
eq("whole numbers in a range", [check(whole, "5", false), check(whole, "5.5", false), check(whole, "11", false), check(whole, "x", false)],
  [null, "must be a whole number from 1 to 10", "must be a whole number from 1 to 10", "must be a whole number from 1 to 10"]);
eq("decimals, open at one end", [check(ruleOf({ kind: "decimal", min: "0" }), "0.5", false), check(ruleOf({ kind: "decimal", min: "0" }), "-1", false)],
  [null, "must be a number of at least 0"]);
const list = ruleOf({ kind: "list", values: "North, South,East" });
eq("a list, any case, spaces trimmed", [check(list, "south", false), check(list, "West", false)], [null, "must be one of North, South, East"]);
eq("a text length", check(ruleOf({ kind: "length", max: "3" }), "abcd", false), "must be at most 3 characters long");
eq("an empty input, and a formula, are not checked", [check(whole, "", false), check(whole, "=A1*100", false)], [null, null]);
eq("on create: only into an empty cell; on update: only over one", [
  check(ruleOf({ kind: "whole", min: "1", when: "create" }), "0", true), check(ruleOf({ kind: "whole", min: "1", when: "create" }), "0", false),
  check(ruleOf({ kind: "whole", min: "1", when: "update" }), "0", false), check(ruleOf({ kind: "whole", min: "1", when: "update" }), "0", true),
], ["must be a whole number of at least 1", null, "must be a whole number of at least 1", null]);
eq("limits as typed", ["1..10", "1 to 10", "1-10", ">=0", "<= 5", "3", "-5..-1", "x"].map(limitsOf),
  [{ min: "1", max: "10" }, { min: "1", max: "10" }, { min: "1", max: "10" }, { min: "0" }, { max: "5" }, { min: "3" }, { min: "-5", max: "-1" }, {}]);
throws("a rule that is not one", () => ruleOf({ kind: "colour" }), RangeError, "colour is not a rule (list, whole, decimal, length)");
throws("a list with nothing in it", () => ruleOf({ kind: "list", values: " , " }), RangeError, "a list rule needs values");

const wb = new Workbook();
const cmds = new Commands(wb);
const message = async (line: string) => (await cmds.run(line)).message;
eq("validation.set on a range", await message("validation.set range=B2:B4 kind=whole min=1 max=10"), "B2:B4 must be a whole number from 1 to 10");
eq("stop: a typed value that breaks it is refused, and the cell keeps what it had", [await message("cell.set cell=B2 input=5"), await message("cell.set cell=B2 input=50"), wb.sheet.input("B2")],
  ["B2 = 5", "B2 must be a whole number from 1 to 10", "5"]);
await cmds.run("validation.set range=C2 kind=list values=Yes,No mode=warn");
eq("warn: kept, and said", [await message("cell.set cell=C2 input=Maybe"), wb.sheet.input("C2")], ["C2 = Maybe (C2 must be one of Yes, No)", "Maybe"]);
await cmds.run("edit.copy range=B2");
await cmds.run("cell.set cell=D9 input=99");
await cmds.run("edit.copy range=D9");
await cmds.run("edit.paste at=B3");
eq("a paste is not checked (as in Excel), but Circle Invalid finds it", [wb.sheet.input("B3"), (await cmds.run("validation.circle")).output],
  ["99", ["C2", "B3"]]);
eq("a circled cell is marked", wb.styleOf("B3").includes("background: #ffd6d6"), true);
eq("rules move with their cells", [await message("rows.insert at=1"), await message("cell.set cell=B4 input=0")], ["inserted 1 row at 1: 7 cells set, 7 changed", "B4 must be a whole number from 1 to 10"]);
await cmds.run("validation.clear range=B3:B5");
eq("validation.clear", await message("cell.set cell=B4 input=0"), "B4 = 0");
// expect: ok whole numbers in a range
// expect: ok decimals, open at one end
// expect: ok a list, any case, spaces trimmed
// expect: ok a text length
// expect: ok an empty input, and a formula, are not checked
// expect: ok on create: only into an empty cell; on update: only over one
// expect: ok limits as typed
// expect: ok a rule that is not one
// expect: ok a list with nothing in it
// expect: ok validation.set on a range
// expect: ok stop: a typed value that breaks it is refused, and the cell keeps what it had
// expect: ok warn: kept, and said
// expect: ok a paste is not checked (as in Excel), but Circle Invalid finds it
// expect: ok a circled cell is marked
// expect: ok rules move with their cells
// expect: ok validation.clear
