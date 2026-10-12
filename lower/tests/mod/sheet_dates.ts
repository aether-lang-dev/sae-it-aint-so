// Dates and times on Excel's serial numbers (days since 1899-12-30, a time
// the fraction of a day; numfmt.ts shows them), and money: the library's
// second batch. A date argument is a serial or a date written as text
// (2024-01-15, 1/15/2024). Financial results are Excel's documented examples.
import { evaluate } from "./sheet/evaluate.ts";
import { parse } from "./sheet/parser.ts";
import { show } from "./sheet/format.ts";
import { CellError } from "./sheet/values.ts";
import type { Value } from "./sheet/values.ts";
import { eq } from "./lib/check.ts";

const cells = new Map<string, Value>([
  ["A1", "2024-01-15"], ["A2", -70000], ["A3", 12000], ["A4", 15000], ["A5", 18000], ["A6", 21000], ["A7", 26000],
  ["B1", 45292], ["B2", 45293],
]);
const env = { get: (k: string): Value => cells.get(k) ?? null };
const ev = (...srcs: string[]): string[] => srcs.map((src) => {
  const v = evaluate(parse(src), env);
  return v instanceof CellError ? `${v.code} ${v.why}` : show(v);
});

eq("DATE, months and days past their ends carried", ev("DATE(2024,1,15)", "DATE(2024,14,1)", "DATE(2024,3,0)", "DATE(24,1,1)"), ["45306", "45689", "45351", "8767"]);
eq("DATEVALUE, ISO or month first", ev('DATEVALUE("2024-01-15")', 'DATEVALUE("1/15/2024")', 'DATEVALUE("nope")'), ["45306", "45306", "#VALUE! 'nope' is not a date"]);
eq("YEAR, MONTH, DAY, of a serial or a date as text", ev("YEAR(45306)", "MONTH(45306)", "DAY(A1)", "YEAR(A1)"), ["2024", "1", "15", "2024"]);
eq("WEEKDAY, three ways of counting", ev("WEEKDAY(45306)", "WEEKDAY(45306,2)", "WEEKDAY(45306,3)"), ["2", "1", "0"]);
eq("EDATE and EOMONTH", ev("EDATE(DATE(2024,1,31),1)", "EOMONTH(45306,0)", "EOMONTH(45306,1)", "EDATE(A1,-12)"), ["45351", "45322", "45351", "44941"]);
eq("DAYS", ev("DAYS(DATE(2024,3,1),DATE(2024,1,1))"), ["60"]);
eq("DATEDIF in each unit", ev(...["Y", "M", "D", "YM", "MD", "YD"].map((u) => `DATEDIF(DATE(2020,5,15),DATE(2024,1,10),"${u}")`), 'DATEDIF(DATE(2024,1,10),DATE(2020,5,15),"Y")'),
  ["3", "43", "1335", "7", "26", "240", "#NUM! DATEDIF's start is after its end"]);
eq("NETWORKDAYS and WORKDAY, with holidays", ev("NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31))", "NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31),B1:B2)", "WORKDAY(DATE(2024,1,5),1)", "WORKDAY(DATE(2024,1,5),-1)", "WORKDAY(DATE(2023,12,29),1,B1:B2)"),
  ["23", "21", "45299", "45295", "45294"]);
eq("TIME, HOUR, MINUTE, SECOND", ev("TIME(18,0,0)", "HOUR(0.75)", "MINUTE(TIME(1,30,0))", "SECOND(TIME(1,2,3))", "HOUR(45306.25)"), ["0.75", "18", "30", "3", "6"]);
eq("TODAY and NOW: today's serial, and now's within it", ev("TODAY()>=45306", "INT(NOW())=TODAY()", "NOW()-TODAY()<1"), ["TRUE", "TRUE", "TRUE"]);

eq("PMT", ev("PMT(0.05/12,360,200000)", "PMT(0,10,1000)", "PMT(0.08/12,10,10000,0,1)"), ["-1073.643246", "-100", "-1030.164327"]);
eq("FV, PV", ev("FV(0.06/12,10,-200,-500,1)", "PV(0.08/12,12*20,500)", "FV(0,12,-100)"), ["2581.403374", "-59777.14585", "1200"]);
eq("NPER, RATE", ev("NPER(0.01,-100,-1000,10000,1)", "RATE(48,-200,8000)", "NPER(0,-100,1000)"), ["59.67386567", "0.007701472488", "10"]);
eq("NPV, IRR", ev("NPV(0.1,-10000,3000,4200,6800)", "IRR(A2:A7)", "IRR(A2:A6)", "IRR(A3:A7)"), ["1188.443412", "0.08663094804", "-0.02124484827", "#NUM! IRR needs a negative and a positive cash flow"]);
// expect: ok DATE, months and days past their ends carried
// expect: ok DATEVALUE, ISO or month first
// expect: ok YEAR, MONTH, DAY, of a serial or a date as text
// expect: ok WEEKDAY, three ways of counting
// expect: ok EDATE and EOMONTH
// expect: ok DAYS
// expect: ok DATEDIF in each unit
// expect: ok NETWORKDAYS and WORKDAY, with holidays
// expect: ok TIME, HOUR, MINUTE, SECOND
// expect: ok TODAY and NOW: today's serial, and now's within it
// expect: ok PMT
// expect: ok FV, PV
// expect: ok NPER, RATE
// expect: ok NPV, IRR
