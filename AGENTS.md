# Notes for agents working on sae

"Sae it ain't so": a fat-UI browser. Pages are small programs in a TypeScript
dialect (modern TypeScript), fetched over HTTP, its types erased in-process, run on QuickJS (Aether's contrib.quickjs), and
rendered as native aether-ui widgets. The design is
`../aether-ui/docs/design/tsyne-migrated.md`; the measurements that justified
building it are `docs/spike-results.md`. Read `README.md` and
`lower/README.md` first.

Maintainers: Paul and Nic, with Claude and Codex. Commit straight to `main`.

## Layout

| Path | What |
|---|---|
| `src/sae_host.ae` | The browser: window and chrome, history, fetch, one `Page` (JSContext, a `ui` handle stack and a `vg` node stack) per load, and every page-API host function (`sae_ui_*`, `sae_vg_*`, `sae_bc_*`) |
| `src/sae_rom.c` | The C that must be C: `main()` and the stdout handle |
| `api_register_` in `src/sae_host.ae` | Installs the page API in each page's QuickJS runtime. **This function is the sandbox boundary**: a page reaches only what is registered here (`fs` and `shell` only in app mode) |
| `services/` | One module per effect a page can ask for (`files`, `shell`), each confined by its imports; `docs/architecture.md` |
| `tools/saejs.ae` | Runs a JS file on sae's engine with only `print`; the lowerer tests use it |
| `lower/` | The dialect lowerer (Aether, import-only package), its tests and its dialect reference |
| `tools/pageserver.ae` | Filesystem-mapped dev page server (`/about` → `site/about.ts`) |
| `tools/saelower.ae` | CLI for the lowerer |
| `site/` | The demo/test site; `tests/spec_nav.ae` drives it |
| `tests/lib/saedriver.ae` | The browser-test driver: Tsyne's TsyneBrowserTest verbs (navigate, back, forward, reload, current_url, assert_url, screenshot) plus page, vg and console queries, on aether-ui's uidriver |
| `tests/run_spec.sh` | Starts the page server and sae-driver, runs a spec, stops both |
| `aether-ui`, `ui`, `vg` | Symlinks into the sibling checkout `../aether-ui`; the README's "Build and run" says why each exists |

## Adding a page-API function

1. A host function in `src/sae_host.ae` with the signature
   `(ctx: ptr, this_val: int, argv: int) -> int` (`ctx` is the page's
   contrib.quickjs runtime, `argv` an array of the arguments), whose first
   line is the page veto (copy the `hide fs, os, client, ...` line from any
   other one; "The page veto" in that file says why) and whose second is
   `argc = quickjs.arg_count(ctx, argv)`. It returns a value handle, 0 for
   undefined, or `sae_throw_type_error(...)`. If it needs something the
   veto hides, add a narrow kernel helper (as `now_ns_` wraps the clock)
   rather than dropping the line.
2. Its `reg_(...)` line in `api_register_`.
3. If it reaches the file system or the system, it goes through a service
   (`services/`), never `std.fs` directly.
4. A page in `site/` and an `it` in `tests/spec_nav.ae`. If the spec needs a
   new kind of question, add a verb to `tests/lib/saedriver.ae`.

JS functions a widget keeps for later are held with `hold_()`/`hold_arg_()`
(a handle of the page's runtime, released with it). Every other handle a
host function takes it releases (`quickjs.release`). Widget callbacks go
through `fire0_`/`fire_num_`, which report what the handler throws and then
run the page's promise jobs.

## Build and test

```sh
./build.sh                                   # target/build/bin/sae
AETHER_UI_WITH_DRIVER=1 ./build.sh           # target/build/bin/sae-driver
(cd tools && ../../aether/build/ae build pageserver.ae -o ../target/pageserver)
../aether/build/ae build tools/saelower.ae -o target/saelower
../aether/build/ae build tools/saejs.ae -o target/saejs
lower/run-tests.sh                           # 29 lowerer tests
tests/run_spec.sh                            # spec_nav: 40 specs
tests/check_page_veto.sh                     # page veto present and enforced
tests/check_layers.sh                        # services held to their imports
```

Toolchain: Aether main (for contrib.quickjs) as a dev tree (`$SAE_AETHER_HOME`, default
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
