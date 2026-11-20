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
| `gate_spec_` in `src/sae_host.ae` | The gate spec: every name a page can reach, said once in a small DSL (docs/design/gate-dsl.md); `api_register_` runs it for each page (and then the prelude), `sae --gate-describe` prints it as JSON lines, and `sae.d.ts` is made from that. **The spec is the sandbox boundary**: a page reaches only what is registered there (`fs` and `shell` only in app mode), and `tests/check_gate.sh` fails a registration anywhere else |
| `services/` | One module per effect a page can ask for (`files`, `documents` (files the person picks), `clipboard`, `bus` (the control bus, with `agent_auth` and `secure_channel` copied from aeo), `shell`, `net`: app.json's `capabilities.http` allowlist and the one place a request is opened; `stdlib`: the `sae:` library and import hashes), each confined by its imports; `docs/architecture.md` |
| `services/channel` + `sdk/saecontrol` | The control channel (`docs/app-backend.md`, "The control channel"): `sae --app <dir> --control-stdio`, started by a program that drives the app over sae's stdin and stdout (claimed first thing in `main`), into the same `bus.serve`; `sdk/saecontrol` is that program's side. `services/frames` reads frames for it and for the backend, and writes theirs a tick at a time with std.ipc's frame writer, never waiting, with a 5 s bound ("The write bound") |
| `services/backend` + `sdk/saebackend` | An app's backend (`docs/app-backend.md`): its own process, started with `os.run_stdio`, the channel its stdin and stdout (the one place sae starts a program; a Linux one in a WSL container through `wslc run -i` on Windows), or with `"channel": "socket"` on a socket pair (`sandbox.spawn_socket`, contained to app.json's `"sandbox"`; a picked document handed over as an open descriptor; `docs/design/ipc-backends.md`), and the library its Aether program imports (`saebackend.open()` takes the socket or claims stdin and stdout; `handed`, `poll`) |
| `apps/` | Example apps: `tasks`; `docstats`, `rexxconsole` (needs `../RexxAE`) and `treewalk`, a backend on a socket each, with a README and a `tests/spec_app_<name>.ae` |
| `natives/` | `module.ae`: the natives module the kernel calls for an app's own native modules (`natives.<name>.<fn>`, `docs/natives.md`); here the stub with none, generated in an app's own host by `tools/saenatives.ae` (`tools/saehost.sh <app>` builds that host, each module checked to be capability-empty) |
| `lib/sae/` | The `sae:` page standard library (`noise`, `scales`, `easing`), written in the dialect; `MANIFEST` holds their build-time hashes (`tools/hash-lib.sh`) |
| `tools/saejs.ae` | Runs a JS file on sae's engine with only `print`; the lowerer tests use it |
| `lower/` | The dialect lowerer (Aether, import-only package), its tests and its dialect reference; the module loader's host half is the `wave1/imports` section of `src/sae_host.ae`. Pages are written with trailing blocks (`f(a) { body }`, `docs/design/trailing-blocks.md`); a callback with parameters stays an arrow |
| `tools/pageserver.ae` | Filesystem-mapped dev page server (`/about` → `site/about.ts`; modules in folders four deep) |
| `tools/saelower.ae` | CLI for the lowerer, `--ts` (the trailing-block desugar alone, types kept, for tsc), and `--from-svg` (an SVG as an AeVG-TS page) |
| `tools/tscheck.sh` | Type-checks pages in either form against `sae.d.ts`: each desugared by `saelower --ts`, then `tsc --strict` (`SAE_TSC` or a tsc on PATH) |
| `tools/saebus.ae` | `sae-bus <app name> <command>`: one command to an app's control bus (finds the courier file, seals, prints the opened answer); what other programs, and the spreadsheet's REXX scripts, drive an app with |
| `site/` | The demo/test site; `tests/spec_nav.ae` drives it |
| `../spraedsheet` | Not here: demo 18, the spreadsheet, moved there on 2026-10-14 (its `app/`, with RexxJS vendored; GitHub `aether-lang-dev/spraedsheet`, formerly `RexxJS/example-app-spreadsheet`). It runs on this checkout (`sae -> ../sae`) and its `./run-tests.sh` runs sae's harnesses on its tests (`lower/run-tests.sh --mod`, `tests/run_spec.sh <path>.ae`); run it before pushing a change to a page API it uses (documents, clipboard, the control bus, the datagrid) |
| `tests/escape/` | The escape corpus: one page per attempt to get out (README "Browser security rules"); `tests/spec_escape.ae` holds each to "refused, logged once". A new browser rule is not done until its attempt is here |
| `tests/lib/saedriver.ae` | The browser-test driver: Tsyne's TsyneBrowserTest verbs (navigate, back, forward, reload, current_url, assert_url, screenshot) plus page, vg and console queries, on aether-ui's uidriver |
| `tests/run_spec.sh` | Starts the page server and sae-driver, runs a spec, stops both (or another repo's spec, by its path) |
| `aether-ui`, `ui`, `vg` | Symlinks into the sibling checkout `../aether-ui`; the README's "Build and run" says why each exists |

## Adding a page-API function

1. A host function in `src/sae_host.ae` with the signature
   `(p: *Page, this_val: int, argv: int) -> int` (`p` is the page whose
   runtime calls it, handed over by `host_fn_`; `argv` an array of the
   arguments), whose first line is its own `seal except <names>`: the
   shortest list it compiles with (write the body, start from `seal except
   quickjs`, add each name the compiler refuses; its own parameters and
   locals need none; a module by its real name, not an import alias; a
   selectively imported const as the body writes it; `string` and `print` in
   backticks). Every name must be in the spec's `basis(...)` or its space's
   `reach(...)` (add it to the reach if the space really needs it), and a
   helper of this file it names opens with the page veto (the `hide fs, os,
   client, ...` line every such helper carries; "The seals and the page
   veto" in that file) or is a `kernel_helper(...)` with its reason
   (`tests/check_gate.sh` part viii). Its second line is `ctx = p.ctx` (the
   page's contrib.quickjs runtime) and its third `argc =
   quickjs.arg_count(ctx, argv)`. Nothing looks a page up by its runtime,
   and there is no global browser: the Browser is `p.browser`. It returns a
   value handle, 0 for undefined, or `sae_throw_type_error(...)`. If it needs
   the kernel, add a narrow helper (as `now_ns_` wraps the clock) and list
   it as a kernel helper, rather than reaching past the seal.
2. Its entry in `gate_spec_` (docs/design/gate-dsl.md): `api("name", host_fn, arity) { ... }` in its `space` (one `api(` per line; the function comes before the arity), or `global_fn`. Everything a page can reach is in the spec: `storage`, `browserContext`, `performance`, `ui`, `vg`, `http`, `fs`, `printing`, `shell`, `documents`, `clipboard`, `bus`, `backend`, `print`, the timer globals, the prelude's globals, `Date.now`, `sqlite.<db>` (`space_each`: its entries go on every database the page gets), `natives.<mod>` (a hidden `raw_space`, its wrapper, and a `provided_dynamic`), the loader's `$sae.m` (`loader_fn`) and the test-only sandbox probe (`test_space`, never in `sae.d.ts`). A member the prelude's or a wrapper's JavaScript provides is a `provided(name, arity)`, with no function, and a wrapper is a `js_wrapper(name, source)` in a `raw_space` of the hidden object, then a `provided_space` for what the page sees. Nothing calls `reg_`, `host_fn_` or `quickjs.set_global` outside the DSL (`tests/check_gate.sh` part v). Then `tools/gen-dts.sh` (it regenerates `sae.d.ts`, which is checked in).
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
../aether/build/ae build tools/saebus.ae -o target/sae-bus
../aether/build/ae build tools/saegate.ae -o target/saegate   # sae --gate-describe | saegate: sae.d.ts (tools/gen-dts.sh)
lower/run-tests.sh                           # 81 lowerer tests (run, err, mod, golden; mod/algos_* test site/algos/ headless; --mod DIR runs another repo's)
tests/run_all.sh                             # every spec and check below, each with its environment (a label filter: tests/run_all.sh spec_app_)
SAE_TEST_SITE_PORT=18091 AETHER_UI_TEST_PORT=19222 tests/run_all.sh   # beside another checkout's run: run_spec.sh runs the specs, the site's pages and the test apps as copies with 8091 and 9222 moved (target/retarget/)
tests/run_spec.sh                            # spec_nav: 45 specs
# A slow engine (the x86_64 lab host ae-x64 runs QuickJS about twelve times slower than the Macs): SAE_TEST_WAIT_SCALE=6 multiplies every wait's three seconds, SAE_PAGE_TIME_MS=60000 lifts the page's 5 s limit per entry into JS (without it "InternalError: interrupted" ends Solver and the like; do NOT set it for spec_app_bus, which asserts the 5 s limit, there SAE_TEST_WAIT_SCALE=6 alone is right); a timing budget in a test (spraedsheet's sheet_large) stays the Mac's.
tests/check_page_veto.sh                     # every page-API function sealed (the six sqlite ones on the veto), seal and veto enforced
tests/check_layers.sh                        # services held to their imports
tests/check_android_sources.sh               # the APK compiles the same C as .build.ae
../aether/build/ae run tests/spec_http_grants.ae   # capabilities.http matching, no window
SAE_TEST_APP=tests/apps/httplist tests/run_spec.sh spec_app_httplist
SAE_TEST_APP=tests/apps/nohttp tests/run_spec.sh spec_app_nohttp
tests/check_storage_scope.sh                   # storage per installed app, per file folder
tests/check_natives.sh                         # an app's native modules: each refusal saenatives makes, one taken, iOS compile
AETHER_UI_WITH_DRIVER=1 tools/saehost.sh tests/apps/natives && SAE_TEST_BIN=$PWD/target/hosts/natives_demo/target/build/bin/sae-driver SAE_TEST_APP=tests/apps/natives tests/run_spec.sh spec_app_natives   # natives.calc on the app's own host
SAE_NATIVES_ABSENT=1 SAE_TEST_APP=tests/apps/natives tests/run_spec.sh spec_app_natives   # on sae's own: absent, the page refused
tests/run_spec.sh spec_timers                  # ui.after/sleep/frame, setTimeout and friends
tests/run_spec.sh spec_globals                 # the global surface, browser
SAE_TEST_APP=tests/apps/globals SAE_APPDATA_DIR=$PWD/target/globals-appdata tests/run_spec.sh spec_globals
../aether/build/ae run tests/spec_origin_rules.ae  # origins, mixed content, Sae-Allow-Origin: no window
tests/run_spec.sh spec_webrules                # no ambient credentials, no Referer, the CORS-alike, coarse clocks
SAE_TEST_APP=tests/apps/clocks tests/run_spec.sh spec_webrules   # app mode: full-resolution clocks
tests/run_spec.sh spec_escape tests/escape     # the red-team corpus: 20 attempts, each refused and logged once (SAE_SANDBOX_PROBE=<dir>, as run_all.sh sets it, installs the probe kernel_slip uses)
SAE_TEST_APP=tests/apps/climb tests/run_spec.sh spec_app_climb   # app mode: navigation cannot climb out of the bundle
AETHER_UI_HEADLESS=1 SAE_TEST_APP=tests/apps/documents tests/run_spec.sh spec_app_documents   # documents: picked files as handles (the driver answers the picker)
(cd tests/apps/backend && AETHER_LIB_DIR=../../../sdk ae build backend/main.ae -o backend/main) && SAE_TEST_APP=tests/apps/backend tests/run_spec.sh spec_app_backend   # an app's backend process
(cd tests/apps/backend_stray && AETHER_LIB_DIR=../../../sdk ae build backend/main.ae -o backend/main) && SAE_TEST_APP=tests/apps/backend_stray tests/run_spec.sh spec_app_backend_stray   # a backend writing outside a frame: stopped, the bytes quoted
(cd tests/apps/backend_deaf && AETHER_LIB_DIR=../../../sdk ae build backend/main.ae -o backend/main) && SAE_TEST_APP=tests/apps/backend_deaf tests/run_spec.sh spec_app_backend_deaf   # a backend that stops reading: the window keeps answering, the backend killed after 5 s
SAE_TEST_APP=tests/apps/backend_wslc tests/run_spec.sh spec_app_backend_wslc   # a wslc backend: refused off Windows; on Windows after sh tests/apps/backend_wslc/build-image.sh
(cd tests/apps/backend_socket && AETHER_LIB_DIR=../../../sdk ae build backend/main.ae -o backend/main) && ae run tests/spec_backend_socket_service.ae   # services/backend's socket transport, no window: any platform (contained on Linux, the refusal elsewhere)
(cd tests/apps/backend_socket && AETHER_LIB_DIR=../../../sdk ae build backend/main.ae -o backend/main) && AETHER_UI_HEADLESS=1 SAE_BACKEND_TEST_ENV=from-the-spec SAE_TEST_APP=tests/apps/backend_socket tests/run_spec.sh spec_app_backend_socket   # a backend on a socket: contained (Linux; the refusal elsewhere), a picked document as a descriptor, restart
(cd apps/docstats && AETHER_LIB_DIR=../../sdk ae build backend/main.ae -o backend/main) && AETHER_UI_HEADLESS=1 SAE_TEST_APP=apps/docstats tests/run_spec.sh spec_app_docstats   # the example apps on a socket backend (Linux), and likewise:
(cd apps/rexxconsole && AETHER_LIB_DIR=../../sdk:../../../RexxAE ae build backend/main.ae -o backend/main) && AETHER_UI_HEADLESS=1 SAE_TEST_APP=apps/rexxconsole tests/run_spec.sh spec_app_rexxconsole   # needs ../RexxAE
(cd apps/treewalk && AETHER_LIB_DIR=../../sdk ae build backend/main.ae -o backend/main) && AETHER_UI_HEADLESS=1 SAE_TEST_APP=apps/treewalk tests/run_spec.sh spec_app_treewalk
SAE_TEST_FLAGS=--control-bus SAE_APPDATA_DIR=$PWD/target/bus-appdata SAE_TEST_APP=tests/apps/bus tests/run_spec.sh spec_app_bus   # the control bus: courier file, sealed requests, every refusal (spec_app_bus_off without the flag)
SAE_TEST_PARENT=1 SAE_TEST_APP=tests/apps/bus tests/run_spec.sh spec_app_channel   # the control channel: the spec starts sae --control-stdio and drives it over stdin/stdout (sdk/saecontrol); no file, nothing listening
AETHER_UI_HEADLESS=1 SAE_CLIP_READ=1 SAE_TEST_APP=tests/apps/clipboard tests/run_spec.sh spec_app_clipboard   # an app's clipboard grant (tests/apps/clipboard_write, SAE_CLIP_READ=0: write only)
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
tests/check_prelude.sh                         # src/sae_prelude.c is tools/embed-prelude.sh of the .js, and it parses
tests/check_spec_lock.sh                      # run_spec.sh's one-spec-at-a-time lock: kept while its owner lives, however old; cleared when it died; its owner's exit status untouched
tests/check_page_sandbox.sh                   # the sandbox's source rules: who may read the environment, every kernel tick guarded, sandbox_push/pop only in the entry helpers, effects after the entry
../aether/build/ae run tests/spec_page_grants.ae   # the page's grant list, by doing each operation under it: no window
tests/check_timed_entries.sh                  # every host read of a page's value (getter, toString, valueOf, toJSON) is a timed entry: no raw quickjs.get/to_string/... outside the js_* helpers
tests/check_gate.sh                          # the gate spec, sae.d.ts and the objects a page really sees agree (twenty dump modes, the natives one on the app's own sae that tools/saehost.sh builds), no registration outside the DSL, every seal within the spec's basis and reach and every helper it names vetoed or a kernel helper, the lowerer's tables equal the spec's, and, with SAE_TSC=<typescript's bin/tsc> or a tsc on PATH, sae.d.ts and 38 real pages, in either form (each through tools/tscheck.sh), pass tsc --strict (tools/gen-dts.sh regenerates the d.ts)
tests/check_gate_probes.sh                   # what the pinned Aether does with the gate's mechanics and seal except (0.926.0's fixes held), and two seal faults it still has as tripwires (they fail when Aether fixes one)
tests/check_listeners.sh                      # tests/lib/listeners.sh (what the app specs ask of lsof: /proc on Linux) sees a TCP and a Unix listener
tests/run_spec.sh spec_reactive                # state, computed, bind (one- and two-way, the template), each, batch
tests/run_spec.sh spec_aevg                    # the AeVG grammar, group cascade, bindings, data join, tweens, events, zoom
tests/run_spec.sh spec_aevg_parity             # corpus pages (tools/gen-corpus.sh) against librsvg's PNGs: mean error
tests/run_spec.sh spec_camera                  # demo 1b (site/camera.ts) and the clock components
tests/run_spec.sh spec_fib_clock               # site/fib_clock.ts: 4:30 and 9:15 pinned, held to geometry
tests/run_spec.sh spec_reorder                 # ui.reorderable: a plain hstack and an each() row dragged over the driver (site/reorder.ts)
tests/run_spec.sh spec_a11y                    # ui.a11y_label/role/description/announce on a widget and a vg scene; vg.on_key: a board from the keyboard (site/a11y.ts)
```

Toolchain: Aether 0.926.0 or later (`AE_PIN` in `pins`: `seal except` that keeps value types and the generated C, admits a function's own parameters, a listed module's constants and a closure's view of the sealed locals (aether #3769), which the page-API functions' seal lines need; contrib.quickjs's 0.915+ API, `quickjs.to_string` returning `(string, error)` and a per-runtime absolute deadline, `set_deadline_ns`, in place of `set_time_limit`; `@keep ptr` parameters, aether#2926; enforce leaving the sandbox off after its block, aether#2905; contrib.sqlite's authorizer
and column API, contrib.quickjs's `arg_bytes`), installed, or a dev tree
(`$SAE_AETHER_HOME`, default `../aether`, built with `make compiler ae
stdlib contrib`; `SAE_AETHER_HOME=none` builds against the installed one even when
`../aether` exists; the bare release links, with contrib/sqlite's archive, since 0.905.0), and aeb at `AEB_REF` (v0.347) or
later (it compiles the C contrib.quickjs ships), installed privately under `target/toolchain`.
aeb's install runs `ae`, so put one on `PATH` first (here the dev tree's):

```sh
PATH=$PWD/../aether/build:$PATH AETHER_HOME=$PWD/../aether \
    make -C ../aeb install PREFIX=$PWD/target/toolchain
```

`saelower`, `saejs` and the page server (built with `ae build`, not
`./build.sh`) need the QuickJS amalgamation in the dev tree too: run
`./build.sh` first, or `sh ../aether/scripts/fetch-quickjs-amalgamation.sh`.

### Windows

`docs/windows.md`: the MSYS2 MINGW64 build (symlinks need
`MSYS=winsymlinks:nativestrict` and `core.symlinks=true`), a page server in
WSL under `wslc`, `SAE_TEST_SERVER=external`, and which specs still fail
there.

### A machine with only sae (a Claude Code cloud session)

`tools/setup-siblings.sh` clones whichever of `../aether`, `../aether-ui`
and `../aeb` is missing, shallow, at the refs in `pins` (aether at tag
`v$AE_PIN`, aether-ui at `AETHER_UI_REF`, aeb at `AEB_REF`), builds aether
(`make compiler ae stdlib contrib` and the QuickJS amalgamation) and installs
aeb into `target/toolchain`. A sibling that already exists is never touched,
and with all three present the script is an instant no-op (no git, no
network). It installs no system packages: on Linux the browser also needs
`libgtk-4-dev libepoxy-dev` (and `xvfb` for the specs; on FreeBSD the X server package, `Xvfb`: with no display
`tests/run_all.sh` starts and stops its own, as it uses xvfb-run on Linux); the headless half
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
- A page-API function runs under the page's grant list (services/pagegrants:
  its storage folder, the toolkit's env switches, picked documents): a
  `getenv`, an `fs.*` outside those, exec or a connection made there is
  refused and reads as "unset" or "Permission denied", with an
  `AETHER_DENIED` line in the audit (`AETHER_SANDBOX_AUDIT=stderr`;
  `tests/run_all.sh` fails on one). Read the environment and resolve paths at
  start or in `page_new_`, not in an entry (`tests/check_page_sandbox.sh`);
  an effect that is not the page's (a URL for the system, a dialog, listening
  on a socket) is checked in the function and queued with `later_add_`, done by
  `later_tick_` once no entry runs. A new kernel timer begins with
  `if b.entry_depth > 0 { return }`.
