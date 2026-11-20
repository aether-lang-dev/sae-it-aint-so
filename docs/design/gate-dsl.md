> **Decided 2026-11-18 (owner): the gate spec is an `.ae` DSL**, the shape this document recommends (not a table in a `.md`). Roadmap section 9, decision 7. Step 0 below has run; its findings change some details of the DSL signatures and of the seal basis, and where the text further down disagrees with them, the findings win.

## Step 0 findings (2026-11-19)

Probes: `tests/check_gate_probes.sh` (the comment table at its top is the reference). Aether 0.923.0, on macOS and on cachyos (Linux): same results. Nothing found is an Aether bug; every refusal matches the documented rules.

| Risk (section 5) | Result | Probe |
|---|---|---|
| 1. `seal except` coverage | **Changed.** Everything the body names from outside must be listed: top-level functions, `println` (E0301), modules (E0304), consts (E0304), enum names (E0304), `extern` C functions such as `putchar` (E0301), and a struct name used in `p as *T`, `heap.new(T)` or `T{...}` (E0200 / E0302). A struct name as a parameter type and `sizeof(T)` are not blocked. `heap` itself is not blocked. Locals, closures and `"${}"` need nothing. On 0.923.0 the function's own parameters had to be listed (E0304, found at step 10); **from 0.926.0 they need not** (`s_param_unlisted`), and a struct literal of an unlisted struct is E0304. | `s_*` |
| 2. Not transitive | **Confirmed.** A sealed function calling a listed helper that uses `fs`, a const and so on compiles and runs. The guarantee is the reviewed helper set. | `c_transitive` |
| 3. Pinned toolchain | **Confirmed on 0.923.0, again on 0.926.0 (step 10), and on 0.931.0 (the pin since 2026-11-20).** `seal except fs` admits every `fs.member` (not one member). `hide fs.read` and `import std.fs hiding (read)` both still bite under `seal except fs`, other `fs.*` stay usable. With `import std.fs as files`: through 0.926.0 the seal had to list the real name `fs` (listing `files` alone was E0304); from 0.931.0 (aether #3781) either name admits it and `hide` of either hides it. So a seal name no longer says which module it is: `import std.fs as list` beside std.list, and `seal except list` reaches std.fs (`m_alias_basis`). `check_gate` part (viii) refuses an import alias of the host among the basis and reach names, which keeps the rule below (modules by their real name) true. Re-check once the pins file moves. | `m_*` |
| 4a. `_ctx` two levels deep | **Confirmed.** The pointer `space` returns is the `_ctx` of the `api` call in its block, and `api`'s return is the `_ctx` of the setters' block. | `d_two_levels` |
| 4b. Top-level function as `@keep fn` from a block | **Confirmed, but the signature must change.** If the `@keep fn` is the last parameter, the trailing block is taken as the closure and the call is refused (E0200). It must come before another parameter. Storing or returning `_ctx` needs `_ctx: @keep ptr` (E0902 otherwise). | `d_fn_last`, `d_ctx_store` |
| 4c. `return` in a block | **Confirmed.** It returns from the enclosing function (`early` returned 42 and skipped the rest). The spec must still never `return` early. | `d_two_levels` |
| 4d. `;` between statements | **Confirmed.** `arg("a"); arg("b")` works. | `d_two_levels` |
| (design fallback) fn values in a struct field | **Works.** Stored in a list of structs, read back and called. | `e_fn_field` |
| 5. Cost per page | **Negligible.** 300 `api` calls with 3 no-op setters, each allocating an entry: 4 us per page load on the Mac, 12 us on cachyos. The per-Browser table is not needed. | `f_timing` |

What changes in the design:

- The DSL signature becomes `api(_ctx: @keep ptr, name: string, f: @keep fn(*Page, int, int) -> int, arity: int) -> ptr`, and the spec writes `api("vstack", sae_ui_vstack, 2) { ... }` (function second, arity last). Same for `global_fn`, `surface` and any other call that takes a host function and a block. Section 1's excerpt and sketch use the old order. Every other `_ctx` function that stores or returns its context takes `@keep ptr`.
- The seal basis (the shared helper set that `tests/check_gate.sh` compares against) lists: the helper function names, `println` and any other builtin the bodies call, `Page` and each struct a body casts to or allocates (`Browser`, `HeldRef`, `VgKey`, `PageMenu` today), the modules it uses by real name (an aliased import such as `printing` is listed under its module's real name; from Aether 0.931.0 the compiler would take the alias too, and `tests/check_gate.sh` refuses it), the consts and enums it reads, and the `extern` functions it calls. Struct names that appear only as parameter types, and `heap`, are not listed. Before step 1, the basis list gets built by compiling each gate function and adding what E0301, E0304, E0200 and E0302 name; a seal with a missing name fails to compile, so the list cannot go unnoticed.
- `string` cannot be written bare in a seal list (E0100, reserved word): write it in backticks. `seal except` may be on any line of the body, but put it first as the page veto does.
- The seal check that reads `api(...)` lines for the host function name now takes the second argument, not the last.

## As built, steps 1 to 7 (2026-11-19)

Steps 1 to 7 are in `src/sae_host.ae` (from the "the gate" banner to `gate_spec_`), `tools/saegate.ae`, `tools/gen-dts.sh`, `tests/check_gate.sh`, `tests/gate/dump.{ts,sh}` and the checked-in `sae.d.ts`. `storage`, `browserContext`, `performance`, `ui`, `vg`, `http`, `fs`, `shell`, `printing`, `documents`, `clipboard`, `bus`, `backend`, `print`, the timer globals, the prelude's globals and `Date.now` are in the spec; `sqlite`, `natives`, `$sae` and the probe joined at step 8 (next section). Where the sections below disagree with this one, this one wins.

**The DSL, as written** (each setter checks the tag that begins its context, `GATE_TAG_SPACE` or `GATE_TAG_ENTRY`, and exits if it was used in the wrong block):

| Call | Where | What |
|---|---|---|
| `space(g, name, cond, seek) { ... }` | spec | a namespace. `cond` is `WHEN_ALWAYS`, `WHEN_APP_OR_WEB_SEEKS` or `WHEN_APP_SEEKS`, decided once, here, from `p.absent` and `app_dir`. Its block holds `reach`, `value`, `provided`, `provided_value`, `js_wrapper` and the entries |
| `api(name, host_fn, arity) { ... }` | space | a function of the namespace. The function is the second argument (Step 0 findings) |
| `global_fn(g, name, host_fn, arity) { ... }` | spec | a bare global |
| `patch(g, global, name, host_fn, arity) { ... }` | spec | a member of a builtin that the page API replaces (`Date.now`). Only for a builtin that the dump does not enumerate: its page-side lines would be compared with the one it describes |
| `value(name, type, src)` | space | a readonly string, set at registration (`browserContext.currentUrl`) |
| `raw_space(g, name, cond, seek) { ... }` | spec | the hidden `__sae_*` object that a wrapper takes and deletes: registered like a space, its entries kind `raw` (checked for arity, never part of what the page is held to; the dump holds that the page has no `__sae_*` global left) |
| `provided_space(g, name, cond, seek) { ... }` | spec | the namespace the wrapper makes (`documents`): no object of its own, only `provided` members. `api` in one is refused |
| `provided_global(g, name, arity) { ... }` | spec | a bare global the prelude provides (`state`) |
| `provided(name, arity) { ... }`, `provided_value(name, type)` | space | a member that the prelude's JavaScript, or a wrapper, provides: nothing is registered, but the page sees it, so it is described and held to the live page. Replaces the design's `surface`, whose name aether-ui's `ui` module already has (as it has `wrap`) |
| `js_wrapper(name, source)` | space | evaluates `source` in the page's runtime once the space's functions are registered (`http.fetch`); nothing when the space is off or describing. Replaces the design's `wrap` |
| `arg`, `opt`, `rest` | entry | a required argument, one that may be left out, the rest parameter (past the arity, not counted) |
| `arg_ts`, `opt_ts` | entry | an argument whose type is TypeScript text: the callbacks (`(text: string) => void`) and the options objects |
| `beyond`, `beyond_ts` | entry | an argument the host reads past the arity, which is not counted: `ui.text(label, block)` has a `.length` of 1 |
| `gives(t)`, `gives_ts(text)`, `gives_promise(t)` | entry | the result: a spec type, TypeScript text, or a promise |
| `signature(text)` | entry | a generic or overloaded signature that replaces the generated one (`state<T>`, `bind`), one call per overload; the entry's parameters are still declared, for the arity check |
| `doc`, `internal` | entry | the JSDoc line; `internal()` keeps the entry out of `sae.d.ts` (still page-reachable) |

- **There is no `cb` setter.** A function argument is `arg("fn", T_FN)`, `T_FRAME_FN` (`requestAnimationFrame`'s `(timestamp) => void`), or `arg_ts("onChange", "(text: string) => void")` where the signature is known. The host reads a callback's parameters when it fires, so the d.ts's callback types are documentation that the specs check, not types that the compiler does.
- **Types** (`T_*`): void, str, str_or_null, num, int, delay, flag (a boolean or a number in; a number out), any, obj, bool, timer, frame, fn, frame_fn, widget, vgnode, grid, handle (a widget or a vg node), block, bytes, points, str_num, and two that render as overloads: `T_LEAD_NUM` (the number a function may stand in for: `vstack([spacing,] body)`) and `T_LEAD_NODE` (`bind_fill([h,] fn)`). `sae.Widget`, `sae.VgNode` and `sae.Grid` are plain `number` aliases, not brands.
- **Each context** (a `GateSpace`, a `GateEntry`) is one object per `Gate`, reused: there is no end-of-block hook, so a space or entry is finished when the next one begins, or at `gate_end_`.
- **`reach` is read since step 10** ("As built, steps 8 to 11"): each space's list of what its functions may name beyond the basis, held to their seal lines by `check_gate` part (viii).
- **Name audit** (tests/check_gate.sh, part iv): the compiler bug (a top-level function X takes the place of a parameter X that a closure captures and passes on as a value) needs a *function-typed* parameter or a local bound to a closure. Strings, ints, floats and ptrs of the same name are not affected (the probes in `/Volumes/Mini3/claude-scratch/sae-gate/repro/audit`). sae, aether-ui and the installed std and contrib have none named like a DSL function, so no setter was renamed; the check keeps it so while the compiler bug stands.

**What the checks hold** (`tests/check_gate.sh`; `tests/check_page_veto.sh`):

- (i) `sae.d.ts` is what `tools/gen-dts.sh` makes of `sae --gate-describe`; (iii) each arity is its count of parameters that are not `rest` or `beyond`; (iv) the name audit above.
- (ii) the page's own keys, `typeof` and `.length`, in sixteen modes of `tests/gate/dump.sh`: a web page seeking nothing or `outgoing-http` and `clipboard`; an app granted and seeking everything, two privileges or nothing; an app granted nothing that seeks everything as optional; an app granted nothing; and nine apps, each granted everything and seeking one privilege. The last eight are what shows a seek spelled wrong or copied from another space (the others cannot tell `print` from `open-urls`). The `app_dir` half of `WHEN_APP_SEEKS` is not observable: a web page cannot seek `local-filesystem` (it is refused at load, or absent as optional), so `available_` already keeps the object out.
- The checks hold the spec to the live page and to `sae.d.ts`; they do not hold the spec's text to the truth. A wrong `when`, `seek` or type that the spec and the registration share agrees with itself. The byte-identical dumps before and after each step (the fixtures kept beside the checkout, never in the tree) are what held the moved namespaces to what they were; from step 7 on the dump is the only fixture, so keep one.
- `check_page_veto.sh` reads `api_register_`, `ae_register_` and the spec, and fails a function with the page-API signature that nothing binds (dead code the check could not see; thirteen superseded `vg` functions and `sae_bc_current_url` were that).

**Departures from the text below**

- Step 4 (a) deleted the superseded first `vg` registrations *and* the thirteen functions behind them. `ui.image` is registered with the other `ui` entries, not in the `vg` block. `vg.easings` (an object) and `vg.animate`, `vg.items` (functions) are `provided`, and `vg.view_box` takes a state or a function (the prelude wraps it).
- Step 5: `ui` is one space (176 host functions, eight provided, the reactive layer's primitives `internal`). The `ui` members that are also globals (`state`, `bind` and so on) are `provided` on `ui` now and become `provided_global` at step 7.
- Step 6: `http.fetch` is a `provided` member with a `js_wrapper`.
- Step 7: `documents`, `clipboard`, `bus` and `backend` are a `raw_space` (`__sae_documents`, with the host functions and the `js_wrapper`) followed by a `provided_space` (the object the page sees). The wrappers' JavaScript is `DOCUMENTS_JS`, `CLIPBOARD_JS`, `BUS_JS` and `BACKEND_JS` constants. An app that declares a backend is in the dump (`no-such-backend`, which sae reports and goes on), and `just-backend` is its mode.
- The conditions of a space are decided in `space()` once; `api_register_` no longer tests any.

## As built, steps 8 to 11 (2026-11-19)

Steps 8 to 11 are built. Step 10 first stopped on three faults of Aether 0.923.0; it was built on 0.926.0, which fixes them, on 2026-11-20 (below), with six sqlite functions left on the veto by two faults 0.926.0 still had, sealed the same day on 0.931.0, which fixes those. One commit each for 8, 9 and 11, with the tsc lane and the `app_dir` note after step 11; step 10 is a commit per space. Where this section and the text below disagree, this one wins.

**Step 8: what was registered outside the spec is in it.** `api_register_` is `gate_register_(p)` (the spec) and `ae_register_(p)` (the prelude); no `reg_`, `host_fn_` or `quickjs.set_global` is left in it.

| Call | Where | What |
|---|---|---|
| `space_each(g, name, seek) { ... }` | spec | `sqlite`: an object for each name the page gets (`sqlite_page_dbs_`: seeked, declared by app.json, not left out), its entries registered on every one. `internal_value("__db", T_STR, V_EACH_NAME)` sets each object's `__db` to its name |
| `raw_space(g, "__sae_natives", WHEN_APP_SEEKS_EACH, "native") { api("call", ...); js_wrapper(...) }` and `provided_dynamic(g, "natives", "native", 1, ts)` | spec | `natives`: the hidden gate, its wrapper (`natives_js_`, made from app.json), and what the page sees, an object of objects of functions of one parameter. Nothing of the second level is described one by one: the live check holds its shape (`natives.<module>.<function>` is a function of the arity given) |
| `test_space(g, name) { ... }` | spec | the sandbox probe, `__sae_probe`: there only in a build with `SAE_SANDBOX_PROBE` and `AETHER_UI_TEST_PORT` (`WHEN_PROBE`). **Decision: in the spec, as test-only**: its seven functions are bound like the rest (the seal and veto checks read them), every entry is `internal`, and `saegate` leaves `when: probe` out of `sae.d.ts` whatever the entries say |
| `loader_fn(g, "m", sae_mod_get, 1)` | spec | `$sae.m`, kept on the page (`p.mod_get`) for every page; described in `$sae`, which only a wrapped page has (`WHEN_WRAPPED`); with `provided_space(g, "$sae", WHEN_WRAPPED, "")` for `url`, `x`, `all`, which the loader's JavaScript makes. Internal |
| `held_fn(g, "fail", sae_mod_fail, 1)` | spec | the engine's handler for a rejected top-level await (`p.mod_fail`): not a name a page can use |

New conditions: `WHEN_APP_SEEKS_EACH` (an installed app that seeks at least one `<seek> <name>` it has), `WHEN_PROBE`, `WHEN_WRAPPED`. `check_gate` dumps four more modes: `probe`, `module` (a page that imports, so it has `$sae`), `just-database` (an app with `notes`) and `just-native` (an app with `calc`, run on its own sae, which `tools/saehost.sh` builds when a source is newer); `dump.ts` goes two levels down for `sqlite` and `natives` and prints `$sae` when there is one; `saegate --expect` takes `--names` for what an each space has. The sixteen earlier modes, compared with the tree before this step (`dump.ts` run on the old binary), are byte-identical, and so are the four new ones. `sae.d.ts` gains `sqlite` (`[database: string]: { all<T>, get<T>, run, transaction<T> }`, `all` and `get` generic so `const rows: Note[] = await db.all(...)` types) and `natives`.

**Step 9: the drift check.** `check_gate` part (v): `reg_`, `glob_fn_`, `host_fn_`, `js_set_global_`, `quickjs.set_global` and `quickjs.function` are called only from the DSL's own functions, and `js_eval_` / `engine_eval_` (the kernel's own JavaScript into a page: wrappers, the prelude, helpers made on first use, a page's units) only from the listed ones. A page-visible name added by a stray call fails it; one added by JavaScript is caught by the live dump. `check_page_veto` reads `loader_fn` and `held_fn` lines too.

**Step 10: `seal except` (2026-11-20, Aether 0.926.0).** The first attempt (2026-11-19, 0.923.0) stopped on three faults: a closure passed to a module function could not see the sealed function's locals (A, 9 functions), a listed module's exported const was refused (B, the sqlite ones), and a struct not on the list silently lost its field types, so the generated C of a sealed tree differed from the unsealed one in 38 functions, two of them wrongly (C). It also found that a function's own parameters had to be listed. Aether 0.926.0 (aether #3769) fixes all four; `pins` moved to it, and `check_gate_probes` part g holds each fix (what must now be accepted beside what must still be refused; each probe fails on 0.923.0).

What was built:

- **The seal lines.** 296 of the 302 bound host functions open with `seal except <names>`, the shortest list each compiles with: found by compiling from `seal except quickjs` and adding each name the compiler refused (five rounds), then dropping `quickjs` where a body never names it. Own parameters are not listed. Lists are 1 to 20 names (6.2 on average; `sae_ui_textfield` 20, `sae_ui_datagrid` 17); 204 distinct names. A const brought in with `import aevg (K_SHAPE)` is listed as the body writes it, `K_SHAPE`, though the compiler's message spells it `aevg_K_SHAPE`. Converted a space at a time, a commit each (storage, browserContext, performance, vg, ui, the global functions, http, fs, printing, shell, the four wrapped spaces, natives, the probe).
- **The generated C is the unsealed tree's.** For every space's commit, `target/build/gen/src__sae_host_gen.c` was compared with the tree before step 10: byte for byte the same (the seal line takes the veto line's place, so even the `#line` numbers agree). Fault C is gone. The commit that adds the policy and the helpers' vetoes moves lines, and there the comparison is function by function with `#line` lines and the line numbers in messages left out: the same but for the three functions it changes and the seven it adds.
- **The policy in the spec.** `basis(g, ...)` (47 names: the engine, `mem`, `list`, `string`, `ui`, `aevg`, the argument and value helpers, and what two or more spaces share: the timer, frame and raster helpers), `reach(...)` in each space (ui 51, vg 54, sqlite 11, storage 7, `__sae_backend` 7, browserContext 6, `__sae_bus` 5, fs, http and `__sae_documents` 3, printing, shell and the probe 2, performance, `__sae_clipboard` and `__sae_natives` 1), `global_reach(g, ...)` for the global kinds (10), and `kernel_helper(g, name, why)` for the ten helpers a seal names that touch the kernel on purpose: the clocks (`now_ns_`, `now_ms_`, `now_unix_ms_`, `esc_perf_now_`), storage's three file calls, `http_start_` (the one place a request is opened), `request_nav_` and `slashes_`. Describing prints them; `saegate --seal` reads them. The basis is "what more than one space uses", less the services (`documents` is in the reach of the two spaces that use it).
- **The helpers carry the veto.** A seal does not reach through calls, so every helper the policy names (142, the basis's and the reaches') opens with the page veto or is a kernel helper: 132 do, 10 are. That is the design's rule for the basis, applied to the reaches too, since a reach helper is as much a way out as a basis one. It holds one call deep: a helper's own helpers are trusted as it is.
- **The checks.** `check_gate` part (viii) (the design's "(v)"): every seal name is in the basis or the reach of the function's space; no basis or reach name is stale; every named helper opens with the veto or is a kernel helper, and a kernel helper does not; only `SEAL_HELD`'s functions keep the veto. `check_page_veto` requires the seal (the veto only for `SEAL_HELD`), holds every veto line in the host to its text, and has seal probes beside its veto probes. Each was shown failing on a wrong input: `files` added to `sae_ui_divider`'s seal, with a `files.read_text` in its body, builds and fails the subset check; an `fs.read` there without the listing fails the compiler; a stale reach name, a helper without its veto, a kernel helper that is not one and a bound function put back on the veto each fail.

**The six sqlite functions, sealed on Aether 0.931.0 (2026-11-20).** On 0.926.0 they kept the veto, by two faults (`check_gate_probes` part h held each as a tripwire; its programs were the minimal repros), which aether #3781 fixed and 0.931.0 released:

- **E**: under a seal, a tuple-destructured local named like a top-level name (a function, a const or an extern) was refused (E0304), though `r = ...` made the same local and the unsealed body shadows the outer name: `sae_sqlite_transaction`'s `r, err = js_call_(...)`. Listing `r` compiled, but would have admitted the outer `r` too. Now the destructure is a new local; the outer `r` stays sealed (`h_tuple_outer`), and rebinding a hidden local of the enclosing body is E0304 "a local is not shadowed" (`h_tuple_param`).
- **F**: a module that shares its last name with another module of the program (`services.sqlite`, which imports `contrib.sqlite`) was not admitted by its name: `seal except sqlite` refused `sqlite.KIND_EXEC` as `services_sqlite.KIND_EXEC`, and only the merged name `services_sqlite` admitted it; `hide` of such a module hid nothing. Now the name the source writes admits it and hides it, and the refusal names it as written with its module (`h_module_twin_unlisted`, `h_module_twin_hidden`). `sae_sqlite_all`, `_get`, `_run`, `_begin`, `_end`.

Their seals list only names already in the `sqlite` reach and the basis, so the conversion was the six seal lines and an empty `SEAL_HELD`: `check_gate` reports 302 sealed of 302 bound, and `check_page_veto` 302 seals and no veto. Part h now asserts the fixed behaviour (each probe fails on 0.926.0, shown with a 0.926.0 install on cachyos). The same fix made a seal admit a module by its import alias (row 3 above), which `check_gate` part (viii) answers by refusing an alias among the policy's names; shown failing with `services.print`'s alias, `printing`, put in the printing reach and in `sae_printing_pdf`'s seal in place of `print`.

**Step 11: cross-checks.** `check_gate` part (vi): `lower/module.ae`'s `SEEKABLE` equals the spec's privilege:object pairs plus `clipboard-read:clipboard`; its `PRIVILEGED` equals the spec's sought objects less `natives`; `sae_host.ae`'s `unsought_` list equals the spec's seeks less `database` and `native` (it also lists `clipboard-read`); `tests/spec_globals.ae`'s `SAE_EVERY_PAGE` equals the spec's always-there spaces plus global functions. `saegate --seeks` and `--always` print the two. Each was shown to fail with one side changed. Found on the way, not changed: the lowerer's `CAPS` (what `cap_check_` refuses without a `seeks` line) lacks `documents`, `clipboard`, `bus`, `backend`, `printing` and `natives`, though `PRIVILEGED` has all of them but `natives`, so using one unsought passes lowering and is a ReferenceError at run time.

**tsc lane** (`check_gate` part vii): `SAE_TSC=<typescript's bin/tsc>` (run with node) or a `tsc` on PATH; otherwise one `skip` line. `sae.d.ts` passes `--strict` alone, and 17 pages of `site/` and 9 of `tests/apps/` (every namespace) type-check against it. Over all 61 pages of `site/` (each alone, `--strict`, `moduleResolution bundler`): 49 pass, and the 12 that do not: `life.ts` and `algos.ts` annotate the toggle's callback `(on: boolean)`, while the host passes a number (the declaration says `number`, true to the runtime; `site/widgets.ts` and `site/rebuild.ts` annotate it so); the import pages (`imports`, `import_*`, `algos`) name specifiers tsc cannot resolve (`sae:scales`, `./x.ts#sha256-...`, URLs, `app:/`), which the d.ts does not declare. In `tests/apps/`: `caps` and `gitify` use `catch (e)` and read `e.message` (`unknown` under `--strict`), `sqlite_demo/second.ts` types `db.get`'s callback `(r: { n: number })` while `get` may give `null` (`db.get<{ n: number }>(...)` would be the call), `sqlite_demo/nosql.ts` indexes `globalThis` by a string, and `imports/*` as above. None needed a change to the spec.

**The `app_dir` half of `WHEN_APP_SEEKS`** is not observable by any dump mode, and none can be made: `available_` answers 0 for every app-only privilege when there is no app, so a page from a file that runs has each one it seeks as optional in `p.absent` (a required one refuses the page at load), and the other half of the test already keeps the object out. Shown: with the `app_dir` test removed and the binary rebuilt, all twenty modes still match. It is held by its text (`check_gate` part v); a behavioural test would need a page registered against a Browser with an empty `p.absent` and no app, which no entry point makes.

**Departures from the design text.** `space_each` takes the kind of seek (`"database"`) instead of a template; `loader_fn` and `held_fn` replace the design's `internal_fn`; `value` has an `internal_value` twin; the probe is a described `test_space` (the design left it outside); `natives` is described by shape, not member by member. Step 10: the seal check is `check_gate` part (viii), not (v); `global_reach` is added for the global functions, which have no space; the helper rule covers the reaches' helpers as well as the basis's; the six sqlite functions kept the veto until Aether 0.931.0 (above); and the policy refuses an import alias, which the compiler no longer does. Open, unverified: the natives dump needs a host built from the tree (13 s on the Mac); `sae.d.ts` is assumed `lib: es2020` with no DOM; the `sae:`, `app:/` and URL module specifiers are not declared; the README table is not generated from the spec.

# SUMMARY (under 500 words)

**Recommended shape.** The spec is an Aether DSL inside src/sae_host.ae. It replaces the body of `api_register_` (sae_host.ae:9724) and `ae_register_` (:8585). It uses ordinary trailing blocks with `_ctx` injection, the same style as aether-ui's builders (closures-and-builder-dsl.md:461-476).

- The spec runs, it is not turned into code. In REGISTER mode, `api_register_` runs it for each page and it installs the functions. In DESCRIBE mode, `SAE_NO_WINDOW=1 sae --gate-describe` runs it once and prints one JSON line per entry.
- Host functions are named as identifiers. The compiler then checks that each one exists and has the right signature, through `reg_`'s `@keep fn(*Page,int,int)->int` (:9707).
- Nothing in Aether is generated. Aether has no compile-time evaluation: builder blocks run at run time (closures-and-builder-dsl.md:640). A generator could only splice text into the one source file aeb compiles (.build.ae: `aether_source("src/sae_host.ae")`).
- `sae.d.ts` is checked in. `tools/saegate.ae` renders it from the DESCRIBE output, and a check regenerates it and compares, the way tests/check_prelude.sh:1-14 already does for sae_prelude.c.
- `seal except` stays hand-written in each host function. The spec declares what each namespace may reach (`reach("files")`). The compiler enforces that the body uses only what the seal lists; the check enforces that the seal lists only the shared helper set plus that reach.

**Steps** (each keeps tests/run_all.sh green; spraedsheet's ./run-tests.sh for steps that touch ui, documents, clipboard or bus):

0. Probe scripts on the pinned toolchain: `seal except` at function-body level, the DSL constructs, cost per page. (Done.)
1. DSL in REGISTER mode only; convert `storage`. (Done.)
2. DESCRIBE mode, tools/saegate, a first sae.d.ts, tests/check_gate.sh (d.ts compare, plus a headless dump of the live global objects compared with DESCRIBE). (Done.)
3. `browserContext`, `performance`, timer globals, `print`, `Date.now`. (Done.)
4. `vg`: delete the duplicate first registrations, then convert. (Done.)
5. `ui`: one commit, not chunks. (Done.)
6. Capability-gated namespaces: `http`, `fs`, `shell`, `printing`. (Done.)
7. Wrapped namespaces (`documents`, `clipboard`, `bus`, `backend`) and the prelude's globals. (Done.)
8. Dynamic namespaces (`sqlite.<db>`, `natives.<mod>`) and the loader's `$sae`.
9. Turn on the drift check: no `reg_`, `glob_fn_`, `host_fn_` or `set_global` outside the gate DSL.
10. Replace the pasted `hide` lines with `seal except`, one namespace at a time, and enforce the subset rule. (Done: on Aether 0.926.0, and the six sqlite functions on 0.931.0.)
11. Cross-checks against the other copies: the lowerer's SEEKABLE, `unsought_`, spec_globals' list; an optional tsc lane.

**Top three risks**

1. **`seal except` on sae's kind of code is unverified.** I am unsure whether it blocks struct names in casts and `heap.new(Page)`, constants, or C externs. It does block top-level functions and enum names: aether tests/syntax/test_seal_except.ae whitelists `greet`, and tests/integration/enum_containment has `seal except Color`. It also does not reach through calls (hide-and-seal.md:80), so the guarantee depends on a reviewed set of helpers. `seal except fs` admitting `fs.member` needs the `lookup_member_symbol` fix (typechecker.c:244). Check the pinned version against that, since another agent is moving pins.
2. **The DSL relies on runtime semantics I have not tested in this exact shape.** The pointer returned by `space` must arrive as `_ctx`. An `@keep fn` value must pass from inside a block. I chose explicit arity because whether a builder body can see the enclosing context is unclear. Every page pays about 306 calls.
3. **Part of what a page sees is JavaScript, not registrations.** The wrappers (sae_host.ae:9944, 9969-10020), the prelude and `natives_js_` cannot be checked by the compiler. Only the headless runtime check holds them. TypeScript also cannot express "exists only if the page seeks it".

---

# FULL DESIGN: the gate generated from one spec (roadmap 1.3 item 2, 3.2, 6 item 3)

## 0. What exists today (evidence)

- **Registration.** `reg_(p, q, obj, name, arity, f)` (src/sae_host.ae:9707) wraps `host_fn_` (:9700), which closes over the page. `glob_fn_` (:9714) does the same for a global. `api_register_` (:9724-10124) makes one object per namespace, calls `reg_` on it, then `quickjs.set_global`. `ae_register_` (:8585-8662) adds `ui._cell` and friends, and registers `vg.scene/circle/...` a second time; the comment at :8602 says these "supersede the earlier registrations". Of the 306 `reg_(` matches, one is the definition.
- **Conditions on what is installed.** `ui`, `vg`, `storage`, `browserContext`, `performance`, `print` and the timer globals are always installed. `http` and `clipboard` depend only on `p.absent` (:9934, :9985). `fs`, `documents`, `bus`, `backend`, `printing` and `shell` also need app mode, `ab.app_dir != ""` (:9949-10033). `p.absent` is built from `absent_of_` (:9293) plus `unsought_` (:9309). `sqlite.<db>` and `natives.<mod>` are per-name and dynamic (:10037-10075).
- **JavaScript wrappers.** These register raw functions on a hidden `__sae_*` global, then evaluate JS that wraps them and deletes the raw global:
  - `http.fetch` (:9944)
  - `documents`, `clipboard`, `bus`, `backend` (:9969-10020)
  - `natives` (`natives_js_`)
  - the prelude (`state`, `computed`, `bind`, `each`, `batch`, `vg.animate`, `vg.items`) (:8655)
- **Aliases.** `fs.readFileSync` (arity 2) and `fs.read_text` (arity 1) both bind `sae_fs_read_text`. `clearTimeout` and `clearInterval` both bind `sae_ui_timer_cancel`. `Date.now` is patched onto an existing builtin (:10107). `browserContext.currentUrl` is a value, not a function.
- **The page veto.** A `hide` line is pasted as the first line of every page-API function. The comment at :646-666 says the end state is `seal except`. tests/check_page_veto.sh uses awk to find the last argument of each `reg_`/`glob_fn_`/`host_fn_` inside `api_register_`, so it misses `ae_register_`'s functions. It then requires each function's first line to be the veto, and probes the compiler.
- **Other copies of the capability-to-object map.**
  - lower/module.ae:974 (`SEEKABLE`)
  - sae_host.ae:9309 (`unsought_`'s list)
  - tests/spec_globals.ae:30 (`SAE_EVERY_PAGE`)
- **Precedents in this repo.**
  - Generated and checked in, compared by a check: sae_prelude.c (tests/check_prelude.sh).
  - A pre-build step that writes a tracked file: build.sh runs tools/hash-lib.sh to write lib/sae/MANIFEST.
  - An Aether tool that writes Aether: tools/saenatives.ae.
  - Headless runs: `SAE_NO_WINDOW=1` (tests/check_module_rules.sh:3-4, :25).
- **spraedsheet's pattern.** app/sheet/described.ts is a description kept beside the implementation. tests/headless/sheet_described.ts reconciles the two: names both ways, and each parameter count against `fn.length`. That keeps the description from drifting by testing it, not by generating from it. This design generates where it can and reconciles the rest (the JS surfaces) the same way.

## 1. The DSL

### Shape

- `space(g, name, when, seek) { ... }` is a regular trailing-block function with `_ctx: ptr` first. It runs first. It decides whether the namespace is installed for this page, creates the JS object, sets the global, and returns a `*GateSpace` that becomes the block's context.
- `api(name, arity, host_fn) { ... }` registers immediately in REGISTER mode and returns a `*GateEntry` as the context for its block.
- The setters (`arg`, `opt`, `rest`, `gives`, `gives_promise`, `doc`, `internal`, `reach` and the others in the table above; no `cb`) return at once in REGISTER mode. In DESCRIBE mode they append to the entry's JSON line.

I used regular blocks with explicit arity, not `builder`, deliberately. Regular `_ctx` blocks are the most-used construct: aether-ui uses them and .build.ae uses `bldr.build() { c.program() {...} }`. A builder would let arity be derived from the parameters, but that needs the builder body to see the enclosing space. That body runs after its config is popped (closures-and-builder-dsl.md:640-660), and I have not verified it works. Instead, DESCRIBE checks that `arity` equals the number of declared non-rest parameters and fails if not, so the duplicated arity cannot drift.

Names avoid libc symbols (config-is-code.md "Pitfalls"), and parameters that closures capture (see the name audit above). aether-ui's `ui` module has top-level `wrap` and `surface`, so the design's `wrap` and `surface` are `js_wrapper` and `provided`.

### Excerpt (34 lines)

```aether
// ===== the gate: every name a page can reach (roadmap 1.3 item 2) =====
// api_register_ runs this per page (G_REGISTER); `sae --gate-describe` runs it
// once (G_DESCRIBE): one JSON line per entry, which tools/saegate turns into
// sae.d.ts and tests/check_gate.sh reads. Nothing outside it calls reg_.
gate_spec_(g: *Gate) {
    space(g, "ui", ALWAYS, "") {
        reach("ui")
        api("vstack", 2, sae_ui_vstack) {
            opt("spacing", T_LEAD_NUM)
            opt("body", T_BLOCK)
            gives(T_WIDGET)
            doc("A column under the current parent; body runs with it as the parent")
        }
        api("slider", 4, sae_ui_slider) {
            arg("min", T_NUM)
            arg("max", T_NUM)
            arg("initial", T_NUM)
            cb("on_change", "v: number")
            gives(T_WIDGET)
        }
        api("sleep", 1, sae_ui_sleep) { arg("ms", T_DELAY)
            gives_promise(T_VOID) }
        api("_cell", 2, sae_ae_cell) { internal() }
    }
    space(g, "fs", APP_SEEKS, "local-filesystem") {
        reach("files")
        api("read_text", 1, sae_fs_read_text) { arg("path", T_STR)
            gives(T_STR) }
        api("readFileSync", 2, sae_fs_read_text) { arg("path", T_STR)
            opt("encoding", T_STR)
            gives(T_STR) }
    }
    space(g, "__sae_clipboard", APP_OR_WEB_SEEKS, "clipboard") {
        api("write", 1, sae_clip_write) { arg("text", T_STR) }
        api("read", 0, sae_clip_read) { gives(T_STR) }
        surface("clipboard", "write_text") { arg("text", T_STR)
            gives_promise(T_VOID) }
        surface("clipboard", "read_text") { gives_promise(T_STR) }
    }
    wrap(g, "sae:clipboard", CLIPBOARD_JS)   // takes __sae_clipboard, deletes it
    global_fn(g, "setTimeout", 2, sae_set_timeout) { cb("fn", "...args: unknown[]")
        arg("ms", T_DELAY)
        rest("args") }
}
```

(Write each setter on its own line in the real file. I folded some here only to keep the excerpt short; I have not checked whether Aether accepts `;` between statements, so do not rely on it.)

### What each entry records

| Field | Where it comes from | Used by |
|---|---|---|
| namespace | `space(..., name, ...)`; `global_fn` means a bare global | REGISTER (object or global), d.ts (`declare const ui: {...}`) |
| when | `ALWAYS`, `APP_OR_WEB_SEEKS` (http, clipboard), `APP_SEEKS` (fs, documents, bus, backend, printing, shell) | REGISTER: `p.absent` / `app_dir` test, exactly as today; d.ts: JSDoc `@seeks` / `@appOnly` |
| seek | the privilege string | REGISTER (`string.contains(p.absent, ",${seek},")`), cross-check against lower/module.ae:974 |
| name | `api("vstack", ...)` | property name |
| arity | explicit; DESCRIBE checks it equals the count of non-rest params | `quickjs.function` length |
| host function | an identifier, so the compiler checks it exists and its type | REGISTER; the seal check reads it from the source line |
| params | `arg` (required), `opt` (optional), `cb` (callback with a TS parameter list), `rest` | d.ts signature |
| result | `gives(T)` or `gives_promise(T)`; nothing means void | d.ts |
| doc | `doc("...")` | d.ts JSDoc, later the README table |
| internal | `internal()`: page-reachable but not documented (`ui._cell`, `_textarea`) | omitted from d.ts, still seal-checked |
| reach | `reach("files")` on a space: names a gate function there may add to its seal beyond the shared basis | seal subset check |
| surface | `surface(global, name)`: a member the JS wrapper or prelude provides; no host function | d.ts only; existence held by the runtime enumeration check |

Spaces still to define the same way:

- `space_each(g, "sqlite", "database", ...)`: a template repeated per database name (:10037).
- `natives`: its members come from app.json, so the d.ts gets `Record<string, Record<string, (arg: string) => Promise<string>>>`.
- `value(g, "browserContext", "currentUrl", T_STR, p.url)`.
- `patch(g, "Date", "now", 0, js_date_now)`.
- `internal_fn(g, "$sae.m", ...)` for the loader's `p.mod_get` and `p.mod_fail` (:10119-10120). These are not globals but are still page-reachable.

### DSL implementation sketch (in sae_host.ae, above `api_register_`)

```aether
struct Gate { mode: int, p: *Page, q: ptr, out: ptr }               // out: strbuilder in DESCRIBE
struct GateSpace { g: *Gate, name: string, obj: int, on: int }      // on: installed for this page
struct GateEntry { s: *GateSpace, name: string, arity: int, nargs: int, line: ptr }
space(_ctx: ptr, name: string, when: int, seek: string) -> ptr     // REGISTER: decides `on`, new_object + set_global
api(_ctx: ptr, name: string, arity: int, f: @keep fn(*Page, int, int) -> int) -> ptr   // calls reg_ when on
arg(_ctx: ptr, name: string, t: int)                                // returns at once unless DESCRIBE
```

`api_register_(p)` becomes four lines: build a `Gate` in REGISTER mode, call `gate_spec_(g)`, run the module-loader setup. In DESCRIBE mode, `space` treats every condition as on, so every entry is printed with its `when` and `seek`, and no JS object is made (`q` is null).

## 2. What is generated, and how

**(a) Registration.** Nothing is generated: the spec runs. Reasons:

- Aether has no compile-time evaluation. The DSL only runs at run time (closures-and-builder-dsl.md:640-660 shows the push/pop C).
- A separate `ae run` generator could only name host functions as strings. It would have to splice generated Aether into the one TU aeb compiles (.build.ae has a single `aether_source("src/sae_host.ae")`). That means a generated region inside an 11k-line hand-edited file, plus a codegen step before aeb on the pinned toolchain for every build, including the Android build that tests/check_android_sources.sh holds to the same C as .build.ae.
- Running the spec makes "a registration the spec doesn't say" structurally impossible once `reg_` is only called from `api`. The compiler checks each host function's name and signature.
- Cost: about 306 `api` calls per page, each doing what `reg_` does now, plus setters that return immediately. Measure it in step 0. The fallback is to build an entry table once per Browser and walk it per page. That fallback needs function values stored in struct fields, which is unverified.

**(b) The `seal except` / `hide` boundary.** This stays in the host functions, because `seal` must sit in the scope it constrains: it does not reach through calls (hide-and-seal.md:80-100), so a generated wrapper that sealed itself would constrain nothing. The spec supplies the policy; a check enforces it:

- `GATE_BASIS` is one reviewed list of names any gate function may use: the module prefixes `quickjs`, `ui` (already narrowed by `import ui hiding (...)`, sae_host.ae:16), `vg`, `aevg`, `mem`, `list`, `string`, `strbuilder`; the constants it needs; and the argument and engine helpers (`arg_str_`, `arg_int_`, `arg_num_`, `lead_int_`, `held_fn_`, `hold_arg_`, `own_arg_`, `own_`, `container_`, `top_`, `push_`, `pop_`, `sae_throw_type_error`, `rethrow_`, `now_ns_`, `ui_done_`, ...). It is written in the spec as `basis("...")` and printed in DESCRIBE.
- Each space's `reach(...)` adds its service: `files` for fs, `documents`, `clipboard`, `printing`, `shell`, and kernel helpers such as `storage_read_` for storage.
- Each bound host function's first line is `seal except <names>`, as short as that body needs. The compiler enforces body ⊆ seal (E0304). tests/check_gate.sh enforces seal ⊆ GATE_BASIS ∪ reach(space). Together, body ⊆ policy.
- Because seal is not transitive, every basis helper must itself open with the veto `hide` or be sealed to the basis. The few that deliberately touch the kernel (`now_ns_`, `storage_read_`, `request_nav_`, `resolve_`) are listed as `kernel_helper("now_ns_", "why")` in the spec, so they are a reviewed list in one place.

**(c) sae.d.ts.** Checked in at sae/sae.d.ts (the roadmap's name; spraedsheet reaches it through its `sae` symlink).

- Produced by `tools/gen-dts.sh`, which runs `SAE_NO_WINDOW=1 target/build/bin/sae --gate-describe | target/saegate > sae.d.ts`.
- tools/saegate.ae is a small Aether program, built with `ae build` like saelower. It reads JSON lines (std.json) and emits TypeScript.
- Checked in because editors and authors (spraedsheet, page writers) need it without a GUI build. An untracked file would force a full sae build just to get types.
- Drift: tests/check_gate.sh regenerates it and compares (`cmp`), as check_prelude.sh does.

Sketch of the output:

```ts
// Generated by tools/saegate from the gate spec in src/sae_host.ae; do not edit.
declare namespace sae { type Widget = number & { readonly __sae: "Widget" }; type Block = () => void; }
declare const ui: {
  /** A column under the current parent; body runs with it as the parent */
  vstack(body?: sae.Block): sae.Widget;
  vstack(spacing: number, body?: sae.Block): sae.Widget;
  sleep(ms: number): Promise<void>;
};
/** @seeks local-filesystem  @appOnly */
declare const fs: { read_text(path: string): string; readFileSync(path: string, encoding?: string): string };
```

## 3. Type vocabulary

Each spec type is listed with the host conversion it stands for.

| Spec type | Host conversion | TypeScript |
|---|---|---|
| `T_STR` | `arg_str_` (:350): `quickjs.arg_string`, "" past the end | `string` (`opt` when "" is a real default) |
| `T_INT` | `arg_int_` (:372): ToInt32 | `number` |
| `T_NUM` | `arg_num_` (:907) | `number` |
| `T_DELAY` | `delay_arg_` (:3867): NaN, negative or overflow becomes 0 | `number` |
| `T_LEAD_NUM` | `lead_int_` (:366): a number a function may stand in for | rendered as overloads |
| `T_FLAG` | `arg_int_` read as 0/1 (toggle, :3134ff) | input `boolean \| number`; output `number` (`get_toggle` returns `new_int`) |
| `T_WIDGET` | `own_arg_` (:3128) / `owned_` (:612): an int handle, must be the page's own | branded `sae.Widget` |
| `T_VGNODE` | vg handles offset by `VG_BASE` (:73) | branded `sae.VgNode` |
| `T_GRID` | the datagrid handle; README says it is not a widget | branded `sae.Grid` |
| `T_TIMER` / `T_FRAME` | ids | branded numbers |
| `T_BLOCK` | `call_arg_` (:406) via `container_` (:596): last argument, called now, optional | `() => void` |
| `cb(name, "params")` | `held_fn_` (:3112) / `hold_arg_` (:508), fired later by `fire0_` (:451) / `fire_num_` (:3119) | `(params) => void \| Promise<void>` |
| `rest` | `rest_args_` (:4054) | `...args: unknown[]` |
| `T_BYTES` | `arg_bytes_` (:6941) | `Uint8Array \| Uint8ClampedArray` |
| `T_POINTS` | `ae_points_arg_` (:7723): "x,y x,y" or a flat number array | `string \| number[]` |
| results | `new_int`, `new_float`, `new_string`, `new_null`, `json_value_` (:9189), `new_promise` (:4101), 0 for undefined | `number`, `string`, `T \| null`, tuples, `Promise<T>`, `void` |

Awkward cases, named:

1. **The block is always last and optional.** `container_` returns the handle without calling anything when there is no function (:598). The leading number is optional only when a block follows. This needs overload rendering, not one signature.
2. **Flags are ints in both directions.** TypeScript callers pass `true`; the host returns `1`.
3. **Handle kinds share one int space.** `context_menu` takes a Widget, a VgNode or `0` (the whole page). Brands need a `| 0`.
4. **Results encoded in strings.** `datagrid_glide_box` returns "r,c", `datagrid_areas` "ar,ac,r,c;...", `datagrid_merge_of` "r,c,rows,cols" or "". These become `string` plus a doc line.
5. **JSON-built results.** `scrollbar_range` builds `[min, max, page]` with `json_value_` (:~1080). This needs `gives_ts("[number, number, number]")` as an escape hatch, used sparingly and listed by the check.
6. **Polymorphic arguments.** `datagrid`'s last argument is a block or a cell function, chosen by the function's length (README "grids"). `text(s)` vs `text(label, block)`. Polygon points.
7. **Callback parameter types come from host code at fire time,** not from argument conversion. So `cb`'s parameter text is documentation that only the specs check.
8. **Three kinds of promise.**
   - Native: `sleep` (:4101), sqlite.
   - JS-wrapped: `documents`, `clipboard`, `bus`, `backend`, `http.fetch`.
   - JS-only: the prelude, natives.

   The wrapped and JS-only kinds are `surface` entries.
9. **Raw `__sae_*` globals.** Registered and then deleted by the wrapper: registered and sealed, never in the d.ts.
10. **Internal members on public objects.** `ui._cell`, `_bind`, `_textarea`, `_top`: page-reachable, so sealed, but not typed.
11. **Aliases.** Same host function, different arity (`readFileSync` 2 vs `read_text` 1).
12. **Superseded double registrations in `vg`.** Delete the dead first set.
13. **Dynamic namespaces.** `sqlite.<db>` and `natives.<mod>`: `Record<string, ...>` now; a per-app d.ts from app.json later.
14. **Patched builtins and values.** `Date.now` needs nothing (lib.es has it). `browserContext.currentUrl` is a readonly string.
15. **Existence depends on mode and seeks, which TypeScript cannot see.** Open question 1 below.
16. **Lib conflicts.** `print`, `setTimeout` and `performance` clash with lib.dom. The d.ts must assume `"lib": ["es2023"]` without DOM.
17. **Throws.** `sae_throw_type_error` refusals can only be documented (`@throws TypeError`).

## 4. Migration (each step verifiable alone; `tests/run_all.sh` green after each)

0. **Probes.** Add tests/check_gate_probes.sh in the style of check_page_veto.sh's `probe()`, compiling with the pinned `ae`. It needs no change to sae. Cases:
   - `seal except` as the first line of a top-level function body, admitting: a module prefix (`quickjs.x`), a top-level function, a `const`, a struct in a parameter, a cast `as *Browser` and `heap.new(Page)`. Accept and reject cases for each.
   - A `seal except fs` that admits `fs.read` (needs typechecker.c:244's fix).
   - The DSL itself: `space(g, ...) { api(..., some_fn) { arg(...) } }` with `_ctx` injection two levels deep, and a top-level function passed into an `@keep fn` parameter from inside a block.
   - A timing of 300 `api` calls.

   **Proof:** every probe gives the expected accept or reject. Write down which names `seal` blocks. This decides whether section 2(b) works as written.
1. **DSL machinery and the `storage` namespace.** Add `Gate`, `space`, `api` and the setters in REGISTER mode only. Convert `storage` (3 entries, always installed, simple types; :10077-10082). Update check_page_veto.sh's awk to also read `gate_spec_`. **Proof:** spec_nav's storage `it`s, spec_storage_scope, check_storage_scope.sh, spec_globals (surface unchanged), check_page_veto.sh.
2. **DESCRIBE, saegate, first sae.d.ts, check_gate.sh.**
   - Add the `--gate-describe` flag, claimed early in `main` like `--control-stdio` (:11002), exiting before any UI.
   - Add tools/saegate.ae and tools/gen-dts.sh.
   - tests/check_gate.sh, part (i): regenerate the d.ts and compare.
   - Part (ii): a headless run (`SAE_NO_WINDOW=1`) of tests/gate/dump.ts, which prints each described global's own keys, `typeof` and `.length`. Compare with DESCRIBE filtered by mode. Run it three ways: a web page, an app seeking everything (like tests/apps/caps), and an app seeking nothing.
   - Part (iii): every entry's arity equals its param count.

   Add it to run_all.sh. **Proof:** the check passes; hand-editing sae.d.ts, or adding a stray `quickjs.set` on `storage`, makes it fail.
3. **`browserContext`, `performance`, timer globals, `print`, `Date.now`.** These need `global_fn`, `value` and `patch`. **Proof:** spec_timers, spec_globals in both modes, spec_webrules (coarse clocks).
4. **`vg`.**
   - (a) Delete the first `vg.scene/circle/rect/rrect/line/path/text/g/fill/stroke/opacity/transform/on_click` registrations (:9905-9917), which `ae_register_` overrides. The arities match.
   - (b) Convert `vg` and `ae_register_`'s `vg` part, including `ui.image`'s registration made in the `vg` block.

   **Proof:** spec_aevg, spec_aevg_parity, spec_raster, spec_camera, spec_terrain, spec_life, spec_algos.
5. **`ui`, in about five commits:** containers and widgets; inputs; timers and input events; a11y and menus; datagrid (about 70 entries). **Proof:** spec_nav, spec_reactive, spec_reorder, spec_a11y, spec_tooltip, spec_ctxmenu, spec_keys, spec_grid, spec_app_menus, spec_menus_web, spec_app_resize, spec_interrupted, and spraedsheet's ./run-tests.sh (it drives the datagrid).
6. **Capability-gated namespaces.** `http` (the `http.fetch` wrapper is a `surface`), `fs`, `shell`, `printing`. **Proof:** spec_app_httplist, spec_app_nohttp, spec_app_caps, spec_app_seeks, spec_app_scoped*, spec_globals in both modes, spec_escape, spec_http_grants.
7. **Wrapped namespaces.** `documents`, `clipboard`, `bus`, `backend` (`space` `__sae_*` + `wrap` + `surface`), and the prelude's globals as `surface` entries. **Proof:** spec_app_documents, spec_app_clipboard, spec_app_bus, spec_app_bus_off, spec_app_channel, spec_app_backend*, spec_reactive, and spraedsheet.
8. **Dynamic and internal spaces.** `sqlite` (`space_each`), `natives`, `$sae` (internal). **Proof:** spec_sqlite_service, spec_app_sqlite, check_sqlite_relaunch.sh, check_natives.sh, spec_app_natives (both hosts), spec_imports, spec_app_imports, check_module_rules.sh.
9. **Drift check on.** check_gate.sh part (iv): `reg_(`, `glob_fn_(`, `host_fn_(` and `quickjs.set_global(` appear in sae_host.ae only inside the gate DSL's own functions (an allowlist of function names, found by awk as check_page_veto does). The runtime dump (ii) catches JS-side additions. **Proof:** add a stray `reg_` in a scratch branch and the check fails.
10. **`seal except`, one namespace at a time.** Add `basis(...)`, `reach(...)` and `kernel_helper(...)`. Replace the veto `hide` line with a minimal `seal except` line in each bound function; the compiler reports anything missing. check_gate.sh part (v) checks seal ⊆ basis ∪ reach for every host function the spec binds, and that every basis helper opens with the veto or is a `kernel_helper`. During migration check_page_veto.sh accepts either line; at the end it requires `seal` and keeps its compiler probes, with seal probes added. **Proof:** both checks pass; a probe adding `files.read_text` to a `ui` function fails the subset check; one adding `fs.read` fails the compiler.
11. **Cross-checks against the remaining copies.** check_gate.sh part (vi):
    - DESCRIBE's space→seek pairs equal lower/module.ae:974 `SEEKABLE` (less `database:sqlite` and `native:natives`, which come from `space_each`).
    - Every seek appears in `unsought_`'s list (:9309).
    - `ALWAYS` globals plus `ALWAYS` surface globals equal spec_globals.ae:30.
    - Optional lane: `tsc --noEmit --erasableSyntaxOnly` over site/*.ts and spraedsheet/app with sae.d.ts.
    - Later: the README page-API table generated from the same DESCRIBE output (roadmap 1.3 item 2).

## 5. Risks and open questions

1. **`seal except` coverage (unsure).** The docs and tests show it blocks outer variables, top-level functions (aether tests/syntax/test_seal_except.ae whitelists `greet`), module prefixes (hide-and-seal.md:127, :318) and enum names (tests/integration/enum_containment). I found nothing that says whether struct names in casts or `heap.new`, `const`s, or `extern` C functions (`putchar`, `malloc` in sae_rom paths) need whitelisting. Step 0 decides. If types must be listed, the basis grows but the design holds.
2. **Not transitive, not a security boundary.** hide-and-seal.md:80 says it does not reach through calls; :236 says it is "Not a security boundary", only compile-time hygiene. The guarantee is "gate bodies name only the reviewed basis", and the basis helpers are the trusted computing base. The `kernel_helper` list makes that reviewable but not compiler-proven.
3. **Pinned toolchain.** `seal except fs` admitting `fs.member` depends on `lookup_member_symbol` (aether compiler/analysis/typechecker.c:244-252). Hiding one member and the `hiding` import need Aether 0.912.0 (check_layers.sh header). Confirm the pins file's Aether includes both. Another agent is changing pins right now, so re-check after it lands.
4. **DSL semantics.**
   - `_ctx` receiving the pointer `space` returns (closures-and-builder-dsl.md:420-476).
   - A top-level function passed as `@keep fn` from inside a trailing block. `reg_` already takes one, but not from inside a block.
   - A `return` inside a spec block returns from `gate_spec_` (closures-and-builder-dsl.md:178-185), so the spec must never `return` early.

   I avoided `builder` because I could not confirm that a builder body sees the enclosing context.
5. **Cost per page.** It runs at run time on every page load: about 306 entries times (one call + a few no-op setters). It is probably negligible next to `quickjs.function`, but measure it in step 0. The fallback is a per-Browser table.
6. **JS surfaces escape the compiler.** Wrappers, prelude and natives_js_ are held only by the runtime enumeration check. Their types (`surface` entries) are as trustworthy as specs that exercise them.
7. **The seal check reads source text.** Mapping an entry to its host function name for the seal check means parsing `api("...", n, fn)` lines, as check_page_veto.sh's awk does today, because a function value has no name at run time. Keep one `api(` per line, enforced by the check.
8. **`.length` changes.** If any arity changes during migration, pages see a different `.length`. Part (iii) of check_gate plus a one-time comparison against today's numbers (dump `.length` before step 1, keep it as a fixture) guards this.
9. **Open question 1:** should capability globals be `declare const fs: Fs` (the lowerer already refuses unsought names, lower/module.ae:974 and :1094) or `Fs | undefined` (correct for "reduced functionality without")? I recommend plain, with JSDoc `@seeks`, plus a `sae-optional.d.ts` variant later if authors ask.
10. **Open question 2:** should the browser binary carry `--gate-describe` (tiny, and headless via `SAE_NO_WINDOW`), or only sae-driver? I recommend always: it exposes nothing a page can reach.
11. **Open question 3:** architecture.md's stage-2 text speaks of "one compiler-checked module boundary" (moving gate functions into their own module, whose imports would be the whitelist). That is a larger refactor because they use `Page` and kernel helpers in sae_host.ae. This design does not block it: the spec and checks carry over if the gate later moves into a module.

### Critical files for implementation
- /Users/paul/scm/sae/src/sae_host.ae (`reg_`/`host_fn_` :9700-9719, `api_register_` :9724, `ae_register_` :8585, argument helpers :350-520, the veto comment :646-666)
- /Users/paul/scm/sae/tests/check_page_veto.sh
- /Users/paul/scm/sae/tests/check_prelude.sh (the regenerate-and-compare pattern for check_gate.sh)
- /Users/paul/scm/sae/tests/spec_globals.ae and /Users/paul/scm/sae/lower/module.ae:974 (the copies to cross-check)
- /Users/paul/scm/aether/docs/hide-and-seal.md and /Users/paul/scm/aether/docs/closures-and-builder-dsl.md (the semantics relied on)
- New: /Users/paul/scm/sae/tools/saegate.ae, /Users/paul/scm/sae/tools/gen-dts.sh, /Users/paul/scm/sae/tests/check_gate.sh, /Users/paul/scm/sae/tests/check_gate_probes.sh, /Users/paul/scm/sae/sae.d.ts