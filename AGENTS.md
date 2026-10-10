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
| `aevg/` | The page's AeVG scene record (`module.ae`: groups that cascade, defs, the viewBox, the handlers the host dispatches) and the SVG-to-AeVG-TS emitter (`tsemit.ae`, behind `saelower --from-svg`) |
| `src/sae_prelude.js` | The reactive surface and the vg helpers that are JavaScript (`state`, `computed`, `bind`, `each`, `batch`, `vg.animate`, `vg.items`), evaluated into every page; embedded as `src/sae_prelude.c` by `tools/embed-prelude.sh` |
| `src/sae_rom.c` | The C that must be C: the stdout handle (`main()` is Aether's, in `src/sae_host.ae`) |
| `api_register_` in `src/sae_host.ae` | Installs the page API in each page's QuickJS runtime. **This function is the sandbox boundary**: a page reaches only what is registered here (`fs` and `shell` only in app mode) |
| `services/` | One module per effect a page can ask for (`files`, `shell`, `net`: app.json's `capabilities.http` allowlist and the one place a request is opened; `stdlib`: the `sae:` library and import hashes), each confined by its imports; `docs/architecture.md` |
| `lib/sae/` | The `sae:` page standard library (`noise`, `scales`, `easing`), written in the dialect; `MANIFEST` holds their build-time hashes (`tools/hash-lib.sh`) |
| `tools/saejs.ae` | Runs a JS file on sae's engine with only `print`; the lowerer tests use it |
| `lower/` | The dialect lowerer (Aether, import-only package), its tests and its dialect reference; the module loader's host half is the `wave1/imports` section of `src/sae_host.ae` |
| `tools/pageserver.ae` | Filesystem-mapped dev page server (`/about` → `site/about.ts`) |
| `tools/saelower.ae` | CLI for the lowerer, and `--from-svg` (an SVG as an AeVG-TS page) |
| `site/` | The demo/test site; `tests/spec_nav.ae` drives it |
| `tests/escape/` | The escape corpus: one page per attempt to get out (README "Browser security rules"); `tests/spec_escape.ae` holds each to "refused, logged once". A new browser rule is not done until its attempt is here |
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
3. If it reaches the file system, the system or the network, it goes
   through a service (`services/`), never `std.fs` or `client.request`
   directly; a network call in app mode is held to app.json `capabilities.http` there.
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
lower/run-tests.sh                           # 71 lowerer tests (run, err, mod, golden; mod/algos_* and mod/sheet_* test site/algos/ and site/sheet/ headless)
tests/run_spec.sh                            # spec_nav: 45 specs
tests/check_page_veto.sh                     # page veto present and enforced
tests/check_layers.sh                        # services held to their imports
tests/check_android_sources.sh               # the APK compiles the same C as .build.ae
../aether/build/ae run tests/spec_http_grants.ae   # capabilities.http matching, no window
SAE_TEST_APP=tests/apps/httplist tests/run_spec.sh spec_app_httplist
SAE_TEST_APP=tests/apps/nohttp tests/run_spec.sh spec_app_nohttp
tests/check_storage_scope.sh                   # storage per installed app, per file folder
tests/run_spec.sh spec_timers                  # ui.after/sleep/frame, setTimeout and friends
tests/run_spec.sh spec_globals                 # the global surface, browser
SAE_TEST_APP=tests/apps/globals SAE_APPDATA_DIR=$PWD/target/globals-appdata tests/run_spec.sh spec_globals
../aether/build/ae run tests/spec_origin_rules.ae  # origins, mixed content, Sae-Allow-Origin: no window
tests/run_spec.sh spec_webrules                # no ambient credentials, no Referer, the CORS-alike, coarse clocks
SAE_TEST_APP=tests/apps/clocks tests/run_spec.sh spec_webrules   # app mode: full-resolution clocks
tests/run_spec.sh spec_escape tests/escape     # the red-team corpus: 18 attempts, each refused and logged once
SAE_TEST_APP=tests/apps/climb tests/run_spec.sh spec_app_climb   # app mode: navigation cannot climb out of the bundle
../aether/build/ae run tests/spec_sqlite_service.ae   # services/sqlite: parameters, rows, migrations, escape routes, no window
SAE_TEST_APP=tests/apps/sqlite_demo tests/run_spec.sh spec_app_sqlite   # sqlite.<name> through pages (resets its own rows)
tests/check_sqlite_relaunch.sh                 # migrations once across a relaunch; a failing migration refuses the app
tests/run_spec.sh spec_imports                 # static import/export, sae:, top-level await, refusals: 11
SAE_TEST_APP=tests/apps/imports tests/run_spec.sh spec_app_imports   # an app importing from its bundle
tests/check_module_rules.sh                    # the loader's rules, headless (file pages, an app's refusals, the library manifest)
tests/run_spec.sh spec_raster                  # pixels from a page: vg.raster/image, ui.image, budgets
tests/run_spec.sh spec_terrain                 # demo 13
tests/run_spec.sh spec_life                    # demo 14
tests/run_spec.sh spec_algos                   # demo 17: sorting generators race on the frame clock
tests/run_spec.sh spec_sheet                   # demo 18: formulas, ripples, parse errors, cycles, a batched paste, drag-resized columns (text needs asks/aether-ui-vg-text-transform.md)
tests/check_prelude.sh                         # src/sae_prelude.c is tools/embed-prelude.sh of the .js, and it parses
tests/run_spec.sh spec_reactive                # state, computed, bind (one- and two-way, the template), each, batch
tests/run_spec.sh spec_aevg                    # the AeVG grammar, group cascade, bindings, data join, tweens, events, zoom
tests/run_spec.sh spec_aevg_parity             # corpus pages (tools/gen-corpus.sh) against librsvg's PNGs: mean error
tests/run_spec.sh spec_camera                  # demo 1b (site/camera.ts) and the clock components
```

Toolchain: Aether 0.801.0 or later (`pins`: contrib.sqlite's authorizer
and column API, contrib.quickjs's `arg_bytes`), installed, or a dev tree
(`$SAE_AETHER_HOME`, default `../aether`, built with `make compiler ae
stdlib contrib`; `SAE_AETHER_HOME=none` builds against the installed one even when
`../aether` exists; the bare 0.801.0 release does not link yet, as it ships
contrib/sqlite's source without its archive), and aeb v0.326 or
later (it compiles the C contrib.quickjs ships), installed privately under `target/toolchain`.
aeb's install runs `ae`, so put one on `PATH` first (here the dev tree's):

```sh
PATH=$PWD/../aether/build:$PATH AETHER_HOME=$PWD/../aether \
    make -C ../aeb install PREFIX=$PWD/target/toolchain
```

`saelower`, `saejs` and the page server (built with `ae build`, not
`./build.sh`) need the QuickJS amalgamation in the dev tree too: run
`./build.sh` first, or `sh ../aether/scripts/fetch-quickjs-amalgamation.sh`.

### A machine with only sae (a Claude Code cloud session)

`tools/setup-siblings.sh` clones whichever of `../aether`, `../aether-ui`
and `../aeb` is missing, shallow, at the refs in `pins` (aether at tag
`v$AE_PIN`, aether-ui at `AETHER_UI_REF`, aeb at `AEB_REF`), builds aether
(`make compiler ae stdlib contrib` and the QuickJS amalgamation) and installs
aeb into `target/toolchain`. A sibling that already exists is never touched,
and with all three present the script is an instant no-op (no git, no
network). It installs no system packages: on Linux the browser also needs
`libgtk-4-dev libepoxy-dev` (and `xvfb` for the specs); the headless half
(`lower/run-tests.sh`, `saelower`, `saejs`, the `check_*` scripts) does not.
SQLite's amalgamation comes from `www.sqlite.org` (aether's `make contrib`),
which a cloud environment's network policy blocks; there the script takes
npm's `better-sqlite3` copy instead (CLAUDECODE-CLOUD.md).

`.claude/settings.json` runs it as a SessionStart hook
(`tools/setup-siblings.sh --hook`), which returns at once unless
`CLAUDE_CODE_REMOTE=true` (set only in Claude Code cloud sessions), so a
local session never runs it at all; in the cloud it reports a failure
rather than failing the session.

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
