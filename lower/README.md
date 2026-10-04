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
| destructuring declarations, including `for (const [a, b] of xs)` heads (one level: renames, defaults, array holes, array rest) | a temporary and one `var` per binding; in a for head, the bindings open each iteration and the per-iteration wrap takes them as parameters |
| default and rest parameters | `if (p === undefined) p = ...;` / `var r = Array.prototype.slice.call(arguments, n);` at the top of the body |
| `0b` / `0o` literals, numeric separators | decimal |
| trailing commas in parameter and argument lists | removed |

`for...of` is passed through: mquickjs runs it natively.

Spread in arrays and calls is lowered to `concat` and `apply`:
`[a, ...b]` becomes `[].concat([a], $sae_spread(b))` and `o.m(...b)`
becomes `o.m.apply(o, [].concat($sae_spread(b)))`, the receiver named by
repeating the path. `$sae_spread` (appended to the page's last line when a
spread is used) takes a string's characters, an array as it is, or any
array-like (`arguments`); mquickjs's `slice` takes only real arrays.
Strings spread into UTF-16 units, not code points as ES2015's do.

**Refused**, each with a `line:col` error: `class`, `async`/`await`,
generators, object spread (`{...o}`), spread in a call to anything but a
name or a dotted path (`f(1)(...a)`, `new F(...a)`), optional chaining
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

## Directives: seal and hide

A page's first statement may be `"seal except ui, http";`: the page may then
name no other capability object (`ui`, `vg`, `http`, `fs`, `shell`,
`storage`, `browserContext`). A function's first statement may be
`"hide fs, http";`: those names are refused in that function and every
function inside it. A name the code binds itself (a parameter `fs`) is
its own, not the capability. Violations are lowering errors:
`page.ts:3:1: http is sealed out of this page`. See
`../docs/app-capabilities.md`.

## catch parameters

MicroQuickJS refuses a second `catch (e)` in one function ("catch variable
already exists"), as upstream's C does, though the language allows it. The
lowerer renames a repeat and re-binds the name at the top of its block
(`catch (e$3) { var e = e$3; ...`), so `e` becomes a function variable,
visible after the catch. A catch inside a catch of the same name would
then overwrite the outer one, so that alone is refused: rename one.
