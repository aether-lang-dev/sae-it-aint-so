# Notes for agents working on sae

"Sae it ain't so": a fat-UI browser. Pages are small programs in a TypeScript
dialect, fetched over HTTP, lowered to ES5 in-process, run on mquickjs-ae, and
rendered as native aether-ui widgets. The design is
`../aether-ui/docs/design/tsyne-migrated.md`; the measurements that justified
building it are `docs/spike-results.md`. Read `README.md` and
`lower/README.md` first.

Maintainers: Paul and Nic, with Claude and Codex. Commit straight to `main`.

## Layout

| Path | What |
|---|---|
| `src/sae_host.ae` | The browser: window and chrome, history, fetch, one `Page` (JSContext + handle stack) per load, and every page-API host function (`sae_ui_*`, `sae_bc_*`) |
| `src/sae_rom.c` | The C that must be C: the generated ROM table, JSValue macro constants, the log sink, `main()` |
| `gen/sae_spec.ae` | The page API's ROM entries, built on mquickjs-ae's genengine (core-only mode 2). **This list is the sandbox boundary**: a page reaches only what is registered here |
| `lower/` | The dialect lowerer (Aether, import-only package), its tests and its dialect reference |
| `tools/pageserver.ae` | Filesystem-mapped dev page server (`/about` → `site/about.ts`) |
| `tools/saelower.ae` | CLI for the lowerer |
| `site/` | The demo/test site; `tests/test_nav.py` drives it |
| `aether-ui`, `mqjs`, `ui`, `ae` | Symlinks into the sibling checkouts (`../aether-ui`, `../mquickjs-ae`) |

## Adding a page-API function

1. A `@c_callback` host function in `src/sae_host.ae` with the C signature
   `(ctx: ptr, this_val: ptr, argc: int, argv: ptr) -> long`.
2. Its ROM entry in `gen/sae_spec.ae`.
3. Its prototype in `src/sae_rom.c` (`SAE_JSFN(...)`), or the ROM table will
   not compile.
4. A page in `site/` and checks in `tests/test_nav.py`.

JS functions a widget keeps for later are held with `hold_()` (a GC root,
released with the page). Anything that allocates in the engine can move
objects: read a held function from its root after allocating, not before
(`call1_str_`).

## Build and test

```sh
./build.sh                                   # target/build/bin/sae
AETHER_UI_WITH_DRIVER=1 ./build.sh           # target/build/bin/sae-driver
(cd tools && ../../aether/build/ae build pageserver.ae -o ../target/pageserver)
../aether/build/ae build tools/saelower.ae -o target/saelower
lower/run-tests.sh                           # 34 lowerer tests
python3 tests/test_nav.py                    # 33 driver checks
```

Toolchain: Aether 0.760+ as a dev tree (`$SAE_AETHER_HOME`, default
`../aether`, built with `make compiler ae stdlib`) and aeb at `ebcb508` or
later, installed privately under `target/toolchain`:

```sh
make -C ../aeb install PREFIX=$PWD/target/toolchain
```

That aeb version matters: earlier ones keep a stale binary when only an
imported module (such as `lower/module.ae`) changes, skip relinking
`sae-driver` after `sae`, and on macOS can report a green node as FAILED.

## Traps

- `os.getenv` returns null, not "", for an unset variable (`env_()`).
- A `heap.new` struct owns its string fields: storing into one frees the old
  value, so copy a field before overwriting it if you still need it.
- Aether's `print` and C stdio buffer separately; page output goes through C
  stdio (`js_print`) so it cannot interleave.
- Navigation is deferred to a one-shot timer; never tear a page down from
  inside its own JS call.
- macOS libc exports `cgetset`; generated C names can collide with libc.
