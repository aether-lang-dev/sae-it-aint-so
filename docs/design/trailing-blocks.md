# Trailing blocks: the dialect's one nesting form

Decided 2026-11-19. Roadmap section 3 ("Growing the dialect: terse,
elegant, still erasable") allows the lowerer one small, documented desugar
beyond erasing TypeScript, and item 7 already names the trailing-block form
the house style. This is that desugar: the grammar, where it stops, how pages
written with it are still type-checked, and what was left out on purpose.

## Why

Paul's post "That Ruby and Groovy language feature"
(paulhammant.com, 2024-02-14) is about the "DSL with scope" style of Ruby
blocks and Groovy closures (Green Shoes, SwingBuilder): children sit inside a
block, calls inside it resolve to the enclosing context with no prefix, and
ordinary code (loops, conditions, handlers) runs inside it. Aether has it
natively (`../aether/docs/closures-and-builder-dsl.md`), and aether-ui's
analog and Fibonacci clocks were rewritten into it (aether-ui commits
dd6d9054 and 17905c24). A sae page could already nest, but every level paid
`() => { ... }`:

```ts
circle(0, 0, r, () => { fill("#fdfdf5"); stroke("#333", w) });
```

With a trailing block the same line is

```ts
circle(0, 0, r) { fill("#fdfdf5"); stroke("#333", w) }
```

The page API was already shaped for it: the host keeps a stack of parents,
and a block passed as the last argument runs with the new widget or shape on
top of that stack (`../aether-ui/docs/design/tsyne-migrated.md`, "Pages stay
declarative").

## The rule

> A `{` on the same line as a call's closing `)`, or as a name, opens a
> trailing block: `f(a) { body }` is `f(a, () => { body })`, and
> `f { body }` is `f(() => { body })`. Wherever JavaScript gives that `{` a
> meaning of its own, it keeps it.

"A name" is an identifier or a dotted chain of them (`g`, `ui.hstack`,
`lib.chart`). "A call" is any call: `f(a)`, `o.m(a)`, `f(a)(b)`, `f?.(a)`,
`f<T>(a)`. The desugar is the same in every expression position, so a block
can end an expression statement, a `return`, an initialiser, an argument, or
an arrow's concise body:

```ts
const face = (r: number) => g {
  circle(0, 0, r) { fill(PAPER); stroke(INK, r * 0.04) }
}
for (let i = 0; i < 12; i++) line(0, -r * 0.92, 0, -r * 0.8) { stroke(INK, r * 0.03); transform(`rotate(${i * 30})`) }
```

The block's value is the call's value (`const s = scene(...) { ... }` holds
the scene), and the expression may go on after it (`g { ... }.id` reads a
property of what `g` returned).

### Where JavaScript keeps its `{`

None of these is a call's `)` or a name in expression position, so none
changes meaning:

| Written | Why the `{` is JavaScript's |
|---|---|
| `if (x) {`, `for (...) {`, `while (x) {`, `switch (x) {`, `catch (e) {`, `with` | the `)` closes a statement's head, not a call |
| `function f(a) {`, `async function`, `function*` | a function's parameters |
| `m(a) {`, `get x() {`, `static m() {`, `constructor() {` in a class or an object literal | a method's parameters |
| `(a) => {`, `a => {` | an arrow's body (`=>` comes between) |
| `x = {`, `f({ a: 1 })`, `[{ }]`, `return {` | an object literal (an operator, `(`, `[` or a keyword comes before) |
| `outer: {` | a labelled block (`:` comes before) |
| `do {`, `else {`, `try {`, `finally {`, `static {` | a keyword comes before |
| `class A extends B {`, `class A extends mixin(B) {` | the class body: the heritage clause is the one place a name or a call is followed by `{` in JavaScript, and the lowerer reads it without trailing blocks |
| `function f(): T {`, `): Promise<void> {`, `type T = {`, `interface I {` | TypeScript type positions, which the lowerer skips as types |

In every other place, a `{` right after a call or a name on the same line is
a syntax error in JavaScript, so the desugar takes nothing JavaScript had.

### Refused, each with an error naming the line and column

1. **The brace on the next line.** Aether and Ruby attach a block only on the
   call's line, and so does sae. JavaScript would read the next line's `{`
   as a separate block statement after an inserted `;`, which in a page is
   almost always a wrapped trailing block that would silently run at the
   wrong level. The lowerer refuses it:

   ```ts
   scene("0 0 400 400", 400, 400)
   {                       // 2:1: a '{' on the line after a call or a name is ambiguous: ...
   ```

   The error says both ways out: put `{` on the call's line for a trailing
   block, or end the call with `;` for a plain block. The same holds after
   a name (`let a = b` then `{` on the next line) and after a trailing block
   (`g { }` then `{`). Nothing else changes: `if (x)` then `{` on the next
   line, an Allman-style `function f()` then `{`, or a class body are
   JavaScript's as always.

2. **A block after something that is not a call or a name.** `a[i] { }`,
   `(f) { }` (a parenthesised expression), `` f`x` { } ``, `new C() { }`,
   `this { }`, a literal: refused ("a trailing block follows a call's ')' or
   a name"). `new` is left out because `new C(a, () => {...})` hides a
   callback inside a constructor call, which reads as something else.

3. **Two blocks.** `f(a) { } { }`: "only one trailing block follows a call".
   A callee that wants two callbacks takes the first as an argument.

4. **Block parameters.** `each(rows) { |row| ... }` (Ruby's spelling):
   "a trailing block takes no parameters; write an arrow". See below.

## What the block is

Exactly an arrow function with a block body, so everything an arrow does it
does:

- `this` and `arguments` are the enclosing function's (lexical), as in Ruby.
- `return` returns from the block, not from the function around it (Ruby's
  non-local return is not there; Groovy's closures behave as sae's do).
- `break` and `continue` cannot reach a loop outside the block (the engine
  says so).
- It is not `async`: an `await` inside it is the engine's syntax error. A
  callback that awaits is written as `async () => { ... }`.
- A `"hide fs"` directive as its first statement works as in any function.

## Parameters: arrows, on purpose

A trailing block takes no parameters. A callback that receives values
(`slider(0, 100, 50, (v) => ...)`, `each(list, key, (item) => ...)`,
`ui.on_drag(h, (phase, x, y) => ...)`) stays an arrow. Reasons:

- An arrow's parameter list is already the short, typed spelling:
  `(item: Row) =>`. Ruby's `|item|` would need its own grammar for types,
  and TypeScript's union types are written with `|`
  (`|v: number | string|`).
- Every spelling inside the braces (`{ (item) => ... }`, `{ item -> ... }`)
  either is already legal JavaScript with another meaning (an arrow
  expression statement) or is new syntax that neither tsc nor an editor
  reads.
- Handlers with parameters are leaves (an `onChange`, a cell function), not
  the nesting that the block exists to make quiet.

The lowerer refuses `{ |x| ...}` with a pointer to the arrow, so the Ruby
habit gets an answer rather than "unexpected '|'".

## The page API: the block is always the last argument

A trailing block goes last, so a function whose zero-parameter callback is
not its last parameter cannot take one. The gate was audited:

- **`computed(fn, ...states)`** took its function first. It is now
  `computed(...states, fn)`: `computed(name) { return name.value ? ... }` or
  `computed(name, () => ...)`. Every caller in sae and spraedsheet moved; no
  shim keeps the old order.
- **`textfield(placeholder, onChange?, body?)`** had an optional handler
  before its block, so `textfield("note") { onsubmit(...) }` would have
  handed the block over as the change handler. It is now
  `textfield(placeholder, body?)`, and the change handler is the ambient verb
  `onchange(fn)` inside the block, beside `onsubmit` and `onfocuschange`:
  `textfield("name") { onchange((s) => ...) }`.
- `setTimeout(fn, ms)` and `setInterval(fn, ms)` keep the web's order: they
  are the web's functions, and sae's own `ui.after(ms) { }` and
  `ui.timer(ms) { }` take the block last.
- Callbacks with parameters before another argument (`bus.serve(fn,
  stopped?)`, `vg.items(list, key, render, update?)`) are not blocks and stay
  as they are.

## Type-checking: `saelower --ts`

A trailing block is not TypeScript, so tsc cannot read a page that uses one.
`saelower --ts page.ts` (and `--ts-module`) applies only the desugar and
leaves the TypeScript in place: no erasure, no module rewrite, no wrapper.
Its output is a `.ts` file with the same lines, which `tsc` checks against
`sae.d.ts` as before; the callback each block became is checked against the
parameter type it lands in (`body?: () => void`), so a block given to a
function that takes none, or a block in a callback's place that needs
parameters, is a type error. Columns move right on a line with a block
(`) {` becomes `, () => {`), lines do not.

`tests/check_gate.sh` runs every page of its list through `saelower --ts`
before tsc, so both forms are held to `sae.d.ts`, and a list entry may be a
page in either form. `tools/tscheck.sh page.ts ...` does the same for any
page an author is writing.

## What an editor understands

An editor's TypeScript service (VS Code, or any tsserver client) does not
know the desugar. On a page in the terse form it shows one syntax error per
block opener (`';' expected` after a call, "Unexpected keyword or
identifier" before a bare name), recovers by reading the block as a plain
block statement, and goes on: completion, hover, go-to-definition and the
type errors of the calls inside the block keep working, because those calls
are ordinary calls to the globals and `sae.d.ts` names. What it cannot do is
check the block against the parameter it is passed to. `tools/tscheck.sh`
(or `check_gate.sh`) is the real check. A tsserver plugin that hides those
syntax errors and maps the desugar is possible later; it is not built.

## Lines and columns

The desugar edits in place, as the module rewrite does: `)` becomes
`, () =>` (or `() =>` after an empty argument list or a trailing comma),
a bare name gets `(() =>` after it, and the block's `}` becomes `})`. Every
line stays where the author wrote it, so an engine error's line number is the
page's; columns after a desugared `)` or `}` on that line move right by a
few characters. `lower/tests/mod/golden/blocks.{ts,js}` holds the exact
rewrite.

## Not done, on purpose

- **No parameters on blocks** (above).
- **No block after `new`** (refusal 2).
- **No brace on the next line** (refusal 1).
- **No implicit receiver.** Groovy's closures resolve unqualified calls on a
  delegate object. A sae page gets that from destructuring once at the top
  (`const { scene, g, circle } = vg`) and from the host's parent stack, which
  is what makes `fill(...)` inside a block reach the shape the block belongs
  to. The desugar does not touch names.
- **No `async` or generator blocks.** Write the arrow.
- **Both forms stay legal.** `f(a, () => { ... })` is still JavaScript and
  still lowers to itself. Pages use the block where it reads better and an
  arrow where the callback takes parameters or is a one-line handler.
