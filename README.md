# Sae it ain't so

A fat-UI browser. It fetches **pages** and renders them as real native
widgets, where a page is a small program (layout plus the logic behind it),
not markup. Tsyne-alike: this is Tsyne's browser mode rebuilt on the Aether
stack, as proposed in `aether-ui/docs/design/tsyne-migrated.md`.

One native binary links three things:

- **mquickjs-ae**: the Aether port of Fabrice Bellard and Charlie Gordon's
  MicroQuickJS, unchanged. Each page gets its own `JSContext` in its own
  fixed memory block.
- **aether-ui**: the native widget toolkit (AppKit here; GTK4 and Win32 are
  the same `ui` builders).
- **sae's host** (`src/sae_host.ae`): the browser window and the page API.

No Node, no bridge process, no IPC: a page's `ui.text("x")` is an
in-process call into aether-ui's `ui/module.ae` builders.

## A page

```js
var clicks = 0;
ui.text("Hello from a page.");
ui.hstack(8, function () {
  ui.btn("Click me", function () {
    clicks = clicks + 1;
    print("clicked " + clicks);
  });
});
```

Container builders take their block as the last argument, the way Aether's
trailing block works: `ui.vstack(4, fn)` makes the stack under the current
parent, runs `fn` with the stack as the parent, and pops it again even if
`fn` throws.

A page reaches only what `gen/sae_spec.ae` registers: the language builtins,
`print`/`console`, and `ui`. There is no `load()`, no file system and no
process access.

## Build and run

Sibling checkouts are reached through symlinks at the repo root:
`aether-ui -> ../aether-ui`, `mqjs -> ../mquickjs-ae`, and `ui`/`ae` into
those two.

```sh
./build.sh                     # target/build/bin/sae
target/build/bin/sae pages/hello.js
SAE_NO_WINDOW=1 target/build/bin/sae pages/hello.js   # build the page, print timings, exit
```

`./build.sh` uses the Aether tree at `$SAE_AETHER_HOME` (default `../aether`)
and the aeb in `target/toolchain/bin` if present. mquickjs-ae needs Aether
0.760+ and aeb b0cc057 or later (see its `ci-pins`).

To drive the window over HTTP with the AetherUIDriver:

```sh
AETHER_UI_WITH_DRIVER=1 ./build.sh
AETHER_UI_TEST_PORT=9333 target/build/bin/sae pages/hello.js &
curl -s localhost:9333/widgets
curl -s -X POST localhost:9333/widget/9/click
```

## Status

First spike from the design doc: five builders bound through the context
stack, click handlers held as GC roots, per-phase timings. Not yet: the
page-dialect lowerer (TypeScript-ish to ES5), HTTP fetch, navigation, the
bytecode cache.
