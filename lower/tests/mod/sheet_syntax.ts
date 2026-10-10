// site/sheet/address.ts, lexer.ts and parser.ts: addresses, tokens with
// their positions, the AST for each form, precedence, and parse errors that
// say where.
import { addrOf, allKeys, keyOf, range, step } from "./sheet/address.ts";
import { FormulaError, tokens } from "./sheet/lexer.ts";
import { parse } from "./sheet/parser.ts";
import { eq, throws } from "./lib/check.ts";

eq("addresses read either case, with spaces", [addrOf("b12"), addrOf(" J20 ")], [{ col: 1, row: 11 }, { col: 9, row: 19 }]);
eq("off the sheet is null", [addrOf("K1"), addrOf("A21"), addrOf("A0"), addrOf("AA1"), addrOf("1A")], [null, null, null, null, null]);
eq("keyOf writes them back", keyOf({ col: 2, row: 4 }), "C5");
eq("a range is a rectangle, row by row, either corner first", [...range(addrOf("B2")!, addrOf("A1")!)], ["A1", "B1", "A2", "B2"]);
eq("the sheet is 10 x 20", [...allKeys()].length, 200);
const cell = (k: string) => addrOf(k)!;
eq("arrow keys step a selection", ["Left", "Right", "Up", "Down"].map((k) => keyOf(step(cell("C3"), k)!)), ["B3", "D3", "C2", "C4"]);
eq("and stop at the edges", [keyOf(step(cell("A1"), "Left")!), keyOf(step(cell("A1"), "Up")!), keyOf(step(cell("J20"), "Right")!), keyOf(step(cell("J20"), "Down")!)], ["A1", "A1", "J20", "J20"]);
eq("any other key is no step", [step(cell("C3"), "Return"), step(cell("C3"), "a")], [null, null]);

const toks = (src: string) => [...tokens(src)].map((t) => `${t.kind}@${t.at}:${t.text}`);
eq("tokens and where they start (after the '=')", toks(`SUM(a1:B2) >= 1.5e2 & "x""y"`), [
  "name@2:SUM", "(@5:(", "ref@6:a1", ":@8::", "ref@9:B2", ")@11:)", "op@13:>=", "num@16:1.5e2", "op@22:&", 'str@24:"x""y"', "end@30:",
]);
eq("a string's doubled quote is one quote", [...tokens(`"x""y"`)][0], { kind: "str", value: 'x"y', at: 2, text: `"x""y"` });
eq("refs and names are upper-cased", [...tokens("a1+sum")].filter((t) => t.kind === "ref" || t.kind === "name").map((t) => "name" in t ? t.name : ""), ["A1", "SUM"]);
throws("an unknown character", () => [...tokens("1 # 2")], FormulaError, "unexpected '#'");
throws("an unclosed string", () => [...tokens(`1 & "abc`)], FormulaError, "a string that never ends");
try { [...tokens("1 # 2")]; } catch (e) { eq("the error knows where", (e as FormulaError).at, 4); }

eq("a number", parse("42"), { kind: "num", value: 42 });
eq("a range", parse("A1:B2"), { kind: "range", from: "A1", to: "B2" });
eq("TRUE and FALSE", [parse("TRUE"), parse("false")], [{ kind: "bool", value: true }, { kind: "bool", value: false }]);
eq("a call with arguments", parse("SUM(A1, 2)"), { kind: "call", name: "SUM", args: [{ kind: "ref", name: "A1" }, { kind: "num", value: 2 }] });
eq("a call without", parse("SUM()"), { kind: "call", name: "SUM", args: [] });

// Shapes as text, to read precedence at a glance.
const tree = (src: string): string => {
  const go = (e: ReturnType<typeof parse>): string => {
    switch (e.kind) {
      case "num": case "bool": return String(e.value);
      case "str": return JSON.stringify(e.value);
      case "ref": return e.name;
      case "range": return `${e.from}:${e.to}`;
      case "neg": return `(-${go(e.arg)})`;
      case "binary": return `(${go(e.left)} ${e.op} ${go(e.right)})`;
      case "call": return `${e.name}(${e.args.map(go).join(", ")})`;
    }
  };
  return go(parse(src));
};
eq("* before +", tree("1+2*3"), "(1 + (2 * 3))");
eq("left to right", tree("8-4-2"), "((8 - 4) - 2)");
eq("^ before *, and left to right too", tree("2*3^2^2"), "(2 * ((3 ^ 2) ^ 2))");
eq("unary minus binds tightest", tree("-2^2"), "((-2) ^ 2)");
eq("& below +, comparisons below &", tree(`A1+1&"x"="2x"`), `(((A1 + 1) & "x") = "2x")`);
eq("parentheses", tree("(1+2)*3"), "((1 + 2) * 3)");
eq("unary plus is nothing", tree("+A1"), "A1");

throws("an unclosed call", () => parse("SUM(A1"), FormulaError, "expected ')' but found the end");
throws("a dangling operator", () => parse("1+"), FormulaError, "expected a value but found the end");
throws("two values", () => parse("1 2"), FormulaError, "unexpected '2'");
throws("a range needs a cell", () => parse("A1:3"), FormulaError, "expected a cell after ':' but found '3'");
throws("a bare name", () => parse("total+1"), FormulaError, "unknown name 'total'");
throws("a stray ')'", () => parse("1)"), FormulaError, "unexpected ')'");
const at = (src: string) => { try { parse(src); return 0; } catch (e) { return (e as FormulaError).at; } };
eq("each error's position, counting the '='", [at("SUM(A1"), at("1+"), at("1 2"), at("(1+2"), at("1+*2")], [8, 4, 4, 6, 4]);
// expect: ok addresses read either case, with spaces
// expect: ok off the sheet is null
// expect: ok keyOf writes them back
// expect: ok a range is a rectangle, row by row, either corner first
// expect: ok the sheet is 10 x 20
// expect: ok arrow keys step a selection
// expect: ok and stop at the edges
// expect: ok any other key is no step
// expect: ok tokens and where they start (after the '=')
// expect: ok a string's doubled quote is one quote
// expect: ok refs and names are upper-cased
// expect: ok an unknown character
// expect: ok an unclosed string
// expect: ok the error knows where
// expect: ok a number
// expect: ok a range
// expect: ok TRUE and FALSE
// expect: ok a call with arguments
// expect: ok a call without
// expect: ok * before +
// expect: ok left to right
// expect: ok ^ before *, and left to right too
// expect: ok unary minus binds tightest
// expect: ok & below +, comparisons below &
// expect: ok parentheses
// expect: ok unary plus is nothing
// expect: ok an unclosed call
// expect: ok a dangling operator
// expect: ok two values
// expect: ok a range needs a cell
// expect: ok a bare name
// expect: ok a stray ')'
// expect: ok each error's position, counting the '='
