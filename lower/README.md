# lower: the page dialect

`lower` turns a page written in sae's dialect into the JavaScript that
QuickJS (sae's engine) runs. The browser runs it in-process on every page
(`src/sae_host.ae`); `target/saelower` runs it from the command line, so a
server can lower pages ahead of time.

```sh
../aether/build/ae build tools/saelower.ae -o target/saelower
target/saelower page.ts > page.js
lower/run-tests.sh
```

It erases TypeScript and does one more thing (Modules, below). It
tokenizes, parses the grammar enough to know what each token is, and
overwrites the TypeScript with spaces (the ts-blank-space approach), so
every line and column stays where the author wrote it: a position in an
engine error is a position in the `.ts`. The JavaScript is passed through
untouched. `lower/run-tests.sh` checks the line count for every test page.

## The dialect

Modern TypeScript, as `tsc --erasableSyntaxOnly` (TS 5.8) accepts it, over
modern JavaScript (ES2023), with one exception: no decorators (QuickJS does
not run them yet). Static `import`/`export` are the dialect's (Modules,
below); `import()` and `import.meta` are not.
Check pages with `tsc --noEmit --erasableSyntaxOnly`; the lowerer erases
types, it does not check them.

**JavaScript, run as written:** classes (fields, `#private`, `static`,
static blocks, getters and setters, `extends`/`super`, `#x in o`),
`async`/`await` and promises, generators and `yield*`, `for await`,
destructuring (nested, defaults, rest, in parameters, catch and assignment),
spread in arrays, calls, `new` and objects, computed keys, optional
chaining (`a?.b`, `f?.()`, `a?.[k]`), `??`, `**`, `&&=`/`||=`/`??=`,
template literals and tagged templates, BigInt, `catch {}` without a
binding, `let`/`const` with their own scopes, arrows with lexical
`this` and `arguments`.

The browser runs a page's pending promise jobs after its first run and
after every handler, timer and http callback, so `await` in a page works,
including on a promise an http callback resolves.

| TypeScript, erased | Refused |
|---|---|
| annotations on variables, parameters, fields and return types | `enum` |
| `interface`, `type` aliases, `declare ...` (statements and class members) | `namespace` / `module` |
| `as T`, `as const`, `satisfies T`, `<T>expr` | parameter properties (`constructor(private x)`) |
| non-null `x!`, definite `let x!: T` and `field!: T`, optional `p?` and `field?` | decorators |
| type parameters and type arguments (`f<T>()`, `new Map<K, V>()`, `class C<T>`) | `import.meta`; `export` in a page; top-level `await` in a module |
| `import type`, `export type`, `type` specifiers in an import or export list | string names in an import list (`import { "a-b" as ab }`) |
| `public`, `private`, `protected`, `readonly`, `override`, `abstract` | |
| `implements I, J`; `abstract` classes and members; index signatures | |
| `this:` parameters, overload signatures (functions and methods) | |

## Modules: the one non-erasure

A static `import` or `export` statement is rewritten, in place, into a
call on `$sae`, the loader object sae's host hands each unit (README,
"Modules"): the host resolves, fetches and runs a page's imports before
the page, so the page itself still runs synchronously. The rewrite stays on
the statement's own lines (a multi-line statement collapses onto its first
line, the rest left blank), so the line count holds; columns after the
statement on that line move. Everything else is erased as before.

| Written | Lowered |
|---|---|
| `import { a, b as c } from "./m.ts"` | `const { a, b: c } = $sae.m("./m.ts")` |
| `import * as ns from "./m.ts"` | `const ns = $sae.m("./m.ts")` |
| `import d from "./m.ts"` | `const d = $sae.m("./m.ts").default` |
| `import "./m.ts"` | `$sae.m("./m.ts")` |
| `export const a = 1, b = 2` | `const a = 1, b = 2;$sae.x($exports, "a", () => a, "b", () => b)` |
| `export function f() {}` (and `class`, `let`, `var`) | `function f() {};$sae.x($exports, "f", () => f)` |
| `export { a, b as c }` | `$sae.x($exports, "a", () => a, "c", () => b)` |
| `export { a as b } from "./m.ts"` | `$sae.x($exports, "b", () => $sae.m("./m.ts").a)` |
| `export * from "./m.ts"` | `$sae.all($exports, $sae.m("./m.ts"))` |
| `export * as ns from "./m.ts"` | `$sae.x($exports, "ns", () => $sae.m("./m.ts"))` |
| `export default expr` | `$exports.default = expr` |

`$sae.m(spec)` returns the namespace object of a module the host already
ran, resolved against the unit's own URL; `$sae.x` defines each export as
a getter on the namespace (so `ns.count` reads a `let` as it is now, and a
module's exports are its whole top-level scope's values, not copies);
`$sae.all` copies another namespace's names (not `default`). An imported
binding is a `const`, a copy taken when the import runs. `import type`,
`export type`, `export interface`, `export declare` and `type` specifiers
in a list are erased as before.

**The wrapper.** A unit that imports, exports or awaits at its top level is
wrapped in one function expression: the prefix `(function ($sae) {` (a
page), `(async function ($sae) {` (a page with a top-level `await`) or
`(function ($sae, $exports) {` (a module) goes before the first character,
so line 1's columns move by its length, and the suffix `})` goes after the
last character, after the final newline if there is one; a file without a
final newline gets one first, the one case that adds a line. The host
evaluates the text to that function and calls it with the loader object
(and, for a module, its namespace); `page_wrapped()` tells it to. A page
with neither import nor top-level `await` is the erased script it always
was. Inside the wrapper, a page's top-level declarations are not globals.

**Top-level `await`.** An `await` (or `for await`) outside every function
makes the page's wrapper `async`, nothing else changes; the page runs on
when its promise settles, and the host reports a rejection as an uncaught
exception. In a module it is refused: a module's exports are ready when the
page runs.

**Positioned errors.** `import`/`export` anywhere but the top level, `export`
in a page, `"seeks"` in a module, `import.meta`, a `\` in a module name,
string names in a list, and top-level `await` in a module are each refused
with the line and column (`lower/tests/err`).

`lower_module(src, name, seeks)` lowers a module (`seeks` is the importing
page's, as `",outgoing-http,"`: the module may name what the page sought);
`page_imports()` lists what the last unit imports (`spec\tline\tcol` per
line) and `page_wrapped()` whether its output is a function to call.
`saelower --module`, `--imports` and `--module-imports` expose them.

## Directives: seeks and hide

A page's first statements may be `"seeks ..."` lines, one privilege each
(`local-filesystem`, `outgoing-http`, `open-urls`, `database <name>`),
optionally scoped
(`"seeks outgoing-http GET,POST /api/*"`) and optionally marked
`, reduced functionality without`. They unlock `fs`, `http`, `shell` and
`sqlite`,
which a page may not name otherwise: `page.ts:3:1: fs needs "seeks
local-filesystem" at the top of the page`. `database` takes the database's
name (a letter or `_`, then letters, digits and `_`), one line per database;
the name is part of the privilege (`"database notes"` in `page_seeks()`),
so `"seeks database notes"` unlocks `sqlite` and the host installs
`sqlite.notes`. The lowerer checks the grammar
(methods, patterns, one privilege per line, required or optional but not
both) and keeps what it found for the host: `page_seeks()` (required
privileges), `page_optional()` and `page_scopes()`. The host checks them
against the page's grants before running it, and every request against the
scopes. A function's first statement may be `"hide fs, http";`: those names
are refused in that function and every function inside it. A name the code
binds itself (a parameter, variable, class or catch binding called `fs`) is
its own, not the capability. See `../docs/app-capabilities.md`.

## Tests

`lower/tests/run/*.ts` are lowered and run on sae's engine (`target/saejs`,
from `tools/saejs.ae`): each must print exactly its `// expect:` lines and
keep its line count. `modern.ts` covers the JavaScript above and
`ts_classes.ts` the TypeScript erased inside classes. `lower/tests/err/*.ts`
must fail with the `// error: line:col: message` they state
(`err/module_*.ts` are lowered as modules). `lower/tests/mod/*.ts` are
pages with imports: each is lowered, its import closure (`./lib/*.ts`
beside it, `sae:*` from `lib/sae`) lowered as modules, and all of it run
behind `tests/mod/harness.js`, a JavaScript stand-in for the host's loader
object, against `// expect:` lines (`imports.ts` is every import and export
form, `tla*.ts` top-level await, `sae_*.ts` the library modules,
`algos_*.ts` and `sheet_*.ts` the modules under demo 17's and 18's pages,
`site/algos/` and `site/sheet/`, reached through the `tests/mod/algos` and
`tests/mod/sheet` links and checked with `lib/check.ts`'s `eq` and `mock`).
`lower/tests/mod/golden/*.ts` are compared with their `.js`: the exact
rewrite.

## History

Until sae moved from mquickjs-ae (an ES5-subset engine) to QuickJS, this
lowerer also rewrote ES2015 to ES5: arrows to functions, `let` to `var`
with each loop iteration wrapped in a function, templates to concatenation,
destructuring to temporaries, spread to `concat`/`apply`, and it refused
classes, async, generators and the rest. All of that went with the engine
that needed it.
