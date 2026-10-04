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

It erases TypeScript and does nothing else. It tokenizes, parses the grammar
enough to know what each token is, and overwrites the TypeScript with spaces
(the ts-blank-space approach), so every line and column stays where the
author wrote it: a position in an engine error is a position in the `.ts`.
The JavaScript is passed through untouched. `lower/run-tests.sh` checks the
line count for every test page.

## The dialect

Modern TypeScript, as `tsc --erasableSyntaxOnly` (TS 5.8) accepts it, over
modern JavaScript (ES2023), with two exceptions: a page is a script, so no
`import`/`export`; and no decorators (QuickJS does not run them yet).
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
| type parameters and type arguments (`f<T>()`, `new Map<K, V>()`, `class C<T>`) | `import` / `export` (except `import type` / `export type`, erased) |
| `public`, `private`, `protected`, `readonly`, `override`, `abstract` | |
| `implements I, J`; `abstract` classes and members; index signatures | |
| `this:` parameters, overload signatures (functions and methods) | |

## Directives: seeks and hide

A page's first statements may be `"seeks <privilege>";` lines
(`local-filesystem`, `outgoing-http`, `open-urls`, one per line or several
separated by commas). They unlock `fs`, `http` and `shell`, which a page may
not name otherwise: `page.ts:3:1: fs needs "seeks local-filesystem" at the
top of the page`. `lower_source` keeps the list for the host
(`page_seeks()`), which checks it against the page's grants before running
it. A function's first statement may be `"hide fs, http";`: those names are
refused in that function and every function inside it. A name the code
binds itself (a parameter, variable, class or catch binding called `fs`) is
its own, not the capability. See `../docs/app-capabilities.md`.

## Tests

`lower/tests/run/*.ts` are lowered and run on sae's engine (`target/saejs`,
from `tools/saejs.ae`): each must print exactly its `// expect:` lines and
keep its line count. `modern.ts` covers the JavaScript above and
`ts_classes.ts` the TypeScript erased inside classes. `lower/tests/err/*.ts`
must fail with the `// error: line:col: message` they state.

## History

Until sae moved from mquickjs-ae (an ES5-subset engine) to QuickJS, this
lowerer also rewrote ES2015 to ES5: arrows to functions, `let` to `var`
with each loop iteration wrapped in a function, templates to concatenation,
destructuring to temporaries, spread to `concat`/`apply`, and it refused
classes, async, generators and the rest. All of that went with the engine
that needed it.
