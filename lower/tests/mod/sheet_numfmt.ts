// site/sheet/numfmt.ts: Excel's number-format language. Sections for
// positive, negative, zero and text; colours and conditions in brackets;
// literals quoted, escaped or bare; 0 # ? placeholders, thousands and
// scaling commas, percent, scientific, fractions; dates and times on
// Excel's serial numbers. And formats.ts choosing between it and the Tauri
// app's dialect.
import { numberFormat } from "./sheet/numfmt.ts";
import { formatStyle, formatted } from "./sheet/formats.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const f = (v: Value, pattern: string) => numberFormat(v, pattern)?.text ?? null;
const all = (pattern: string, ...vs: Value[]) => vs.map((v) => f(v, pattern));

eq("decimals, rounded half away from zero", all("0.00", 3.14159, -3.14159, 0, 1.005), ["3.14", "-3.14", "0.00", "1.01"]);
eq("thousands", all("#,##0", 1234567.8, -1234, 0), ["1,234,568", "-1,234", "0"]);
eq("a negative section takes no sign of its own", all("#,##0.00;(#,##0.00)", -1234.5, 1234.5), ["(1,234.50)", "1,234.50"]);
eq("a zero section, with a literal", all('#,##0;(#,##0);"-"', 0, -5, 7), ["-", "(5)", "7"]);
eq("colours", [numberFormat(-5, "#,##0;[Red]-#,##0"), numberFormat(5, "#,##0;[Red]-#,##0")], [{ text: "-5", color: "#ff0000" }, { text: "5" }]);
eq("percent", [f(0.256, "0%"), f(0.256, "0.0%")], ["26%", "25.6%"]);
eq("# shows only what is there; ? holds its place with a space", [f(0.5, "#.##"), f(1, "#.##"), f(1.5, "0.0#"), f(1.25, "0.0#"), f(1.256, "0.0#"), f(1.5, "?.??")],
  [".5", "1.", "1.5", "1.25", "1.26", "1.5 "]);
eq("scientific, and engineering", [f(12345, "0.00E+00"), f(0.000123, "0.00E+00"), f(12345, "##0.0E+0"), f(12345, "00.00E+00"), f(0, "0.0E+0")],
  ["1.23E+04", "1.23E-04", "12.3E+3", "12.35E+03", "0.0E+0"]);
eq("fractions", [f(1.25, "# ?/?"), f(0.5, "# ?/?"), f(1.3, "# ?/8"), f(0.333, "?/??"), f(2.75, "?/?")], ["1 1/4", " 1/2", "1 2/8", "1/3 ", "11/4"]);
eq("literals: quoted, escaped, bare, and placeholders between them", [f(123456789, "000-00-0000"), f(5, '"Total: "0'), f(5, '0" kg"'), f(5, "0\\ \\k\\g"), f(1000, "$#,##0.00"), f(-150.5, "$#,##0.00")],
  ["123-45-6789", "Total: 5", "5 kg", "5 kg", "$1,000.00", "-$150.50"]);
eq("scaling commas", [f(12345, "0,"), f(12345678, "0.0,,")], ["12", "12.3"]);
eq("_ is a space as wide as what follows, * a fill (left out)", f(1234, "_(* #,##0_)"), " 1,234 ");
eq("General", [f(3.5, "General"), f(-2, "General;(General)"), f("pears", "General")], ["3.5", "(2)", null]);
eq("text: a fourth section's @, or text left alone", [f("hi", '0;-0;0;"text: "@'), f(5, '0;-0;0;"text: "@'), f("hi", "0.00"), f("hi", '@" !"')], ["text: hi", "5", null, "hi !"]);
eq("conditions", [numberFormat(150, "[>=100][Red]0;[<0][Blue]0;0"), numberFormat(50, "[>=100][Red]0;[<0][Blue]0;0")], [{ text: "150", color: "#ff0000" }, { text: "50" }]);
eq("dates on Excel's serial numbers", all("yyyy-mm-dd", 45306).concat(all("d mmm yyyy", 45306), all("dddd", 45306), all("mmmm d, yyyy", 45306), all("m/d/yy", 45306), all("ddd dd/mm/yy", 61)),
  ["2024-01-15", "15 Jan 2024", "Monday", "January 15, 2024", "1/15/24", "Thu 01/03/00"]);
eq("times: 12 hours with AM/PM, m as minutes beside h or s, elapsed hours", [f(0.75, "h:mm AM/PM"), f(0.5 + 5 / 86400, "hh:mm:ss"), f(1.5, "[h]:mm"), f(0.5 + 65 / 86400, "mm:ss"), f(45306.25, "yyyy-mm-dd hh:mm"), f(0.1, "h:mm a/p")],
  ["6:00 PM", "12:00:05", "36:00", "01:05", "2024-01-15 06:00", "2:24 a"]);
eq("a date typed as text is the date", f("2024-01-15", "d mmm yyyy"), "15 Jan 2024");

eq("formats.ts: Excel's language unless a part is the app's", [formatted(-5, "#,##0;[Red](#,##0)"), formatted(0.5, "bold;percent:0%;color:red"), formatted(1000, "$#,##0.00"), formatted("hi", '0;0;0;"<"@">"')],
  ["(5)", "50%", "$1,000.00", "<hi>"]);
eq("and the colour a section gives is the cell's", [formatStyle(-5, "#,##0;[Red](#,##0)"), formatStyle(5, "#,##0;[Red](#,##0)"), formatStyle(5, "bold;color:red")],
  ["color: #ff0000", "", "font-weight: bold; color: #ff0000"]);
// expect: ok decimals, rounded half away from zero
// expect: ok thousands
// expect: ok a negative section takes no sign of its own
// expect: ok a zero section, with a literal
// expect: ok colours
// expect: ok percent
// expect: ok # shows only what is there; ? holds its place with a space
// expect: ok scientific, and engineering
// expect: ok fractions
// expect: ok literals: quoted, escaped, bare, and placeholders between them
// expect: ok scaling commas
// expect: ok _ is a space as wide as what follows, * a fill (left out)
// expect: ok General
// expect: ok text: a fourth section's @, or text left alone
// expect: ok conditions
// expect: ok dates on Excel's serial numbers
// expect: ok times: 12 hours with AM/PM, m as minutes beside h or s, elapsed hours
// expect: ok a date typed as text is the date
// expect: ok formats.ts: Excel's language unless a part is the app's
// expect: ok and the colour a section gives is the cell's
