# lower: the page dialect

`lower` turns a page written in sae's dialect into the ES5 subset that
mquickjs-ae runs unchanged. The browser runs it in-process on every page
(`src/sae_host.ae`); `target/saelower` runs it from the command line, so a
server can lower pages ahead of time.

```sh
../aether/build/ae build tools/saelower.ae -o target/saelower
target/saelower page.ts > page.js
lower/run-tests.sh
```

It is a source-to-source tool that never re-prints the program. It tokenizes,
parses enough of the grammar to know what each token is, and records edits
against the source text. TypeScript is overwritten with spaces, so lines and
columns stay put. ES2015 forms are rewritten in place, keeping their line
breaks, so a line number in an engine error is a line of the `.ts` the author
wrote. `lower/run-tests.sh` checks the line count for every test page.

## The dialect

**TypeScript:** what `tsc --erasableSyntaxOnly` (TS 5.8) accepts. Check pages
with real `tsc --noEmit --erasableSyntaxOnly`; the lowerer erases types, it
does not check them.

| Erased | Refused |
|---|---|
| annotations on variables, parameters and return types | `enum` |
| `interface`, `type` aliases, `declare ...` | `namespace` / `module` |
| `as T`, `as const`, `satisfies T`, `<T>expr` | parameter properties (`constructor(private x)`) |
| non-null `x!`, definite `let x!: T`, optional `p?` | |
| type parameters and type arguments (`f<T>()`, `new Map<K, V>()`) | |
| `this:` parameters, overload signatures, `import type` / `export type` | |

**ES2015, rewritten to ES5:**

| Form | Becomes |
|---|---|
| arrow functions | `(function (...) { ... })`, plus `.bind(this)` when the arrow (or an arrow inside it) uses `this` |
| `let` / `const` | `var`. When a loop's head or body declares one and a closure is created in the loop, each iteration runs in its own function (`(function (i) { ... }).call(this, i)`), so the closure sees that iteration's binding. A `let` without an initializer gets `= void 0`. |
| template literals | `("a" + (x) + "b")`, one quoted piece per line |
| shorthand properties and methods | `{ a: a, f: function () { ... } }` |
| destructuring declarations (one level: renames, defaults, array holes, array rest) | a temporary and one `var` per binding |
| default and rest parameters | `if (p === undefined) p = ...;` / `var r = Array.prototype.slice.call(arguments, n);` at the top of the body |
| `0b` / `0o` literals, numeric separators | decimal |
| trailing commas in parameter and argument lists | removed |

`for...of` is passed through: mquickjs runs it natively.

**Refused**, each with a `line:col` error: `class`, `async`/`await`,
generators, spread (`...` in calls, arrays and objects), optional chaining
(`?.`), `??`, `**`, `&&=`/`||=`/`??=`, computed keys, tagged templates,
destructuring assignment and parameters, nested patterns, BigInt, `import`
and `export` (a page is a script).

Four uses are refused because lowering would change what they mean:

- a `let`/`const` declared again in an inner block of the same function
  (both would become the same `var`);
- `break`, `continue` or `return` inside a loop body that has to be wrapped
  per iteration;
- assigning a loop variable inside such a body (each iteration gets a copy);
- `arguments` inside an arrow function.

## Tests

`lower/tests/run/*.ts` are lowered and run on mquickjs-ae's `mqjs`. Each must
print exactly its `// expect:` lines and keep its line count.
`lower/tests/err/*.ts` must fail with the `// error: line:col: message` they
state. Without the per-iteration wraps, `letloop.ts` prints `for 3` three
times; that is the bug the wrap exists to prevent.
