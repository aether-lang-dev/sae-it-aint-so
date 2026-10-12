// site/sheet/csv.ts: rows of text as CSV and back (RFC 4180: a field with a
// comma, a quote or a line break is quoted, a quote in it doubled).
import { fromCsv, toCsv } from "./sheet/csv.ts";
import { eq, throws } from "./lib/check.ts";

const rows = [["Item", "Cost"], ["Pens, blue", "1.5"], ['say "hi"', "two\nlines"], ["", "x"]];
eq("written: quoted only where it must be", toCsv(rows), 'Item,Cost\n"Pens, blue",1.5\n"say ""hi""","two\nlines"\n,x');
eq("and read back", fromCsv(toCsv(rows)), rows);
eq("CRLF, a last line break, and short rows", fromCsv("a,b\r\nc\r\n"), [["a", "b"], ["c"]]);
eq("nothing is no rows", fromCsv(""), []);
eq("a quoted field holds its line breaks and commas", fromCsv('"a\r\nb","c,d"'), [["a\r\nb", "c,d"]]);
throws("a quoted field that never ends", () => fromCsv('a\n"b,c'), RangeError, "a quoted field that never ends, on line 2");
throws("text after a closing quote", () => fromCsv('"a"b'), RangeError, "text after a closing quote, on line 1");
// expect: ok written: quoted only where it must be
// expect: ok and read back
// expect: ok CRLF, a last line break, and short rows
// expect: ok nothing is no rows
// expect: ok a quoted field holds its line breaks and commas
// expect: ok a quoted field that never ends
// expect: ok text after a closing quote
