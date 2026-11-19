# sandbox.enforce around every page entry (roadmap 1.3 item 1, section 6 item 2)

Design, 2026-11-19 (Opus, read-only survey of sae 1fde857 and aether 0.923.0). Not started; step 0's probes come first, as with the gate DSL.

## Summary (at most 350 words)

**What I recommend building.** Put a single grant level around every outermost entry into a page's JS. The push and pop go in sae's timed-entry helpers `entry_begin_`, `entry_end_` and `entry_stopped_` (src/sae_host.ae:9673-9696). That is one place, and tests/check_timed_entries.sh already makes every eval, call, job run and value conversion go through it.

Do not call `sandbox.enforce` on each entry. It copies the grant list every time (std/sandbox/module.ae:152-177). The frozen copy would also refuse a document the person picked earlier in the same `run_jobs`. Instead, build each page's grant list once, in `page_new_`, from the page's mode, its capabilities and `p.absent`. Push it with the runtime's own `sandbox_push`/`sandbox_pop` builtins (codegen_expr.c:12624-12633), which are what `enforce` uses underneath (module.ae:155-157). Push only when the page's entry depth goes from 0 to 1, because the runtime panics past 64 levels (aether_sandbox.c:299-303).

A browser page's list holds its own storage folder and nothing else. An app page adds its `fs` roots, plus each picked document as it is picked. Work the host does on the page's behalf either fits that list or is moved out of the entry: kernel ticks wait until no entry is running, and modal dialogs, `shell.open` and printing run after the entry. Push and pop cost about 50-100 ns per entry. Hoisting the per-entry `getenv` that runs today saves more than that.

**Steps.**
- 0: probes (P1-P5).
- 1: read the environment and compute paths outside entries.
- 2: find the page from its runtime.
- 3: count entry depth and add the kernel-tick guard.
- 4: benchmark.
- 5: a `services/pagegrants` service that builds the lists.
- 6: turn enforcement on, with `tests/escape/kernel_slip.ts`.
- 7: report refusals through the audit log.
- 8: app-mode spec.
- 9: move dialogs and URL opening out of entries.
- 10: LD_PRELOAD lane.
- 11: FreeBSD lane.
- 12 (optional): enforce in the HTTP fetcher.

**Top three risks.**
1. **LD_PRELOAD without a grant file makes `syscall()` return ENOSYS for the whole process** (libaether_sandbox_preload.c:1434-1445). GLib's futex calls and Mesa may then spin or break. Unverified; probe P3 settles it.
2. **The preload checks the in-process levels only if sae exports `aether_sandbox_check_resolved`.** It reaches it through a weak symbol (preload:82), which needs `-rdynamic`. Whether aeb links sae that way is unverified (probe P2). If it doesn't, the lane passes but enforces nothing.
3. **Nested event loops inside entries.** The GTK file chooser and clipboard read (aether_ui_gtk4.c:4417, 4496) and AppKit's `runModal` (aether_ui_macos.m:4939, 4963) run the kernel's ticks under the page's level. A refusal there looks like a missing file or variable, so breakage is silent unless guarded and asserted.

---

## 1. Threat model

Today a page reaches only the host functions `api_register_` installs, and some services check their own inputs. Under both, sae's own Aether code on the UI thread during a page entry (gates, kernel helpers, services) is also held to that page's grants by std's own checks (std/fs, os, net, udp: 38+31+4+2 call sites). On the LD_PRELOAD lane, libc `open`/`fopen`/`openat`, `connect` (AF_INET/6), `getenv` and the exec family on that thread are held too (preload:101-135). So a slip in that code becomes a refusal that is logged instead of an effect: a path joined from page input, a missing scope check, a service acting for the wrong page, or toolkit C opening a file a page named.

It does not contain an engine memory-safety bug. The levels are ordinary data in sae's process: an attacker running code can call `aether_sandbox_restore` or make raw syscalls (containment-sandbox.md:403-424 and 828-837; architecture.md, "Limits"). It also does nothing for work off the UI thread or after the entry: the HTTP fetchers, SQLite workers, natives jobs and the backend process. Actors run with no grants (containment-sandbox.md:257; std/sandbox/README.md:139-150), so a page's network traffic is not held by this level at all.

There is no kernel enforcement until the page host is its own process (roadmap 1.3 item 5). Capsicum applies to a whole process and cannot be undone (capsicum_autosandbox.c), so it cannot scope individual entries.

## 2. Where enforcement goes, and how scopes work in Aether

**Mechanism, from the source.**
- **Per thread.** Each thread has its own stack of up to 64 levels (aether_sandbox.c:276-294; aether_sandbox.h:30-33). A push records the grant pointer and the current try-frame depth (296-313). A pop removes the top level (324-329).
- **Nesting intersects.** A check walks every level and allows only what all of them allow (443-477). Filesystem paths are resolved through symlinks and `..` first (481-493).
- **A NULL grant list allows everything** (aether_sandbox.h:38-39). Never push a null list: use a browser-wide empty list instead, which denies everything (aether_sandbox.c:426).
- **The fast path is one atomic load** when no thread holds a level (aether_sandbox.h:83-89).
- **`enforce` freezes a private copy on every call** (module.ae:152-177), costing O(n) `strdup`s.
- **Trusted names are lexical** (containment-sandbox.md:1535-1571). They only cover calls written inside the block, not calls the engine's C dispatcher makes into gates, so they cannot be used here.
- **Actor steps hide the levels.** An actor step, including one run inline when a send finds an idle receiver on the same core, sets the caller's levels aside and restores them afterwards (aether_sandbox.c:398-417; aether_step_barrier.h). So messages sent from inside an entry run with no grants.
- **Panics clean up.** A panic removes the levels pushed inside the frame that catches it (379-390).
- **A permanent cost after the first push.** The first push sets a flag that makes every later actor step look at the levels, out of line, for the life of the process (88-91, 103-111).
- **The preload checks the in-process levels first** (preload:76-83, 101-135). `bind`, `listen`, `accept`, `mmap`/`mprotect`, `dlopen` of libc and `syscall` are checked only when a grant file is active (443-477, 1200-1240, 1357-1381, 1397-1445).

**Placement.**
- Push in `entry_begin_` and pop in `entry_end_` and `entry_stopped_`, only when `p.entry_depth` goes 0→1 or 1→0. Nested conversions and re-entrant calls from host functions reuse the level already in force.
- Order: set the deadline from a cached `b.page_time_ms` first, then push. On the way out, check the audit log (step 7), then pop.
- The wrappers only receive `q`. The page has to be found from it: either add `quickjs.set_host(q, p)` / `quickjs.host(q)` to contrib.quickjs (one new field in `AeQjs`, aether_quickjs.c:57-76), or pass `p` into every helper (184 call sites, 67 helpers that take only the runtime).
- Keep a browser-wide count, `b.entry_depth`.

**Nesting with legitimate host work.** Nested levels can only narrow, and nothing can widen from inside. So whatever a host function does during the entry must be inside the page's list:
- Storage: the page's own folder, computed and created in advance.
- The files service: its `fence_` grants. Its own nested `enforce` (services/files/module.ae:241-262) then narrows further.
- Documents: the picked path. Add it to the live page list in `adopt` with `sandbox.grant_fs_read` and `sandbox.grant_fs_write` (module.ae:271-274). Because a push lends the list rather than copying it, the next check sees the new grant.

Everything else moves out of the entry:
- Kernel ticks (`bus_tick_` 4437/4550, `backend_tick_` 4843, `sqlite_poll_` 6408, `http_poll_` 9018, the navigation timer 10939) start with `if b.entry_depth > 0 { return }`.
- `shell.open`, the print dialog, the document pickers and the clipboard read keep their checks synchronous but perform the effect in a one-shot kernel timer, like navigation already does.
- HTTP fetchers and SQLite workers are actors, so they are unaffected and also not held. Holding them needs their own `enforce` in `http_do_` (step 12).
- Callbacks delivered later (timers, frames, HTTP and SQLite replies, bus, backend, menu getters) are themselves entries, so each gets the level.

## 3. Grant lists, and what each platform enforces

**Browser page.** Built once in `page_new_` after `absent` is known (10817-10839):
```aether
g = sandbox.new("page ${origin}") {
    grant_fs_read(sdir)              // esc_storage_used_ lists the folder itself
    grant_fs("${sdir}/*")            // its keys: read, write, remove
    // no tcp: requests go through the HttpFetcher actors; no env, exec or native
}
```
`sdir` is `p.storage_dir`, made with `mkdir_p` outside any entry.

The roadmap's outer list (`grant_tcp("*")` plus the cache folder) and per-page `grant_tcp(origin)` add nothing on the UI thread. Build one list per page that stays under the browser's limit by construction, and test that it does. Two runtime levels would double the check cost.

**App page** (with `seeks local-filesystem`, `documents`, `print`):
```aether
g = sandbox.new("app page ${url}") {
    grant_fs_read(sdir)
    grant_fs("${sdir}/*")
    if fs_on == 1 {
        i = 0
        while i < strarr.size(reads) { grant_fs_read("${strarr.get(reads, i)}*"); i = i + 1 }
        j = 0
        while j < strarr.size(writes) { grant_fs("${strarr.get(writes, j)}*"); j = j + 1 }
    }
    // documents: added at adopt(); print and shell: none (their effects run after the entry)
}
```
`fs_on` is 1 when `local-filesystem` is not in `p.absent`. `reads` and `writes` are the files service's resolved roots: have `services/files` export `add_grants(h, g)` so the two lists cannot drift apart.

**Lane preload set.** On the LD_PRELOAD lane, add read-only grants for the toolkit's data (fonts, icon themes, the gdk-pixbuf loader cache). Discover the set by audit rather than guessing. Never add write, exec or tcp.

**Per platform.**

| Platform | In-process std checks | libc layer (LD_PRELOAD) | Kernel layer |
|---|---|---|---|
| Linux | yes | open, connect, getenv, exec | none for sae's own process |
| FreeBSD | yes | same as Linux (containment-sandbox.md:590-593) | none for this process |
| macOS | yes | no (594) | no |
| Windows | yes | no (595, 694-707) | no |
| iOS, Android | yes, if `-DAETHER_HAS_SANDBOX` is set (ae_cross.c:762, 1225; proven per lane by the probe) | no | no |

The in-process layer is pure C and works everywhere (containment-sandbox.md:597-598). On FreeBSD, Landlock and seccomp apply only to spawned children, and Capsicum only to the separate-process stage.

**The guarantee.** Everywhere: std filesystem, environment, exec and tcp operations by sae's Aether code during an entry stay within the page's list. Linux and FreeBSD lanes add the same for libc calls from any code on the UI thread.

## 4. Performance

**Per-entry cost.** A push or pop is a few TLS writes, an acquire load, `aether_try_depth` and one relaxed atomic add or subtract on `g_threads` when the depth crosses zero (aether_sandbox.c:95-116). Add `audit.count()` (one mutex) and that is about 50-100 ns per outermost entry.

For comparison, every entry today already calls `getenv("SAE_PAGE_TIME_MS")`, which scans the whole environment (9653), plus `now_ns`. Hoisting that read pays for the sandbox.

**Budget.**
- 1,000 datagrid cells × about 3 entries each × 100 ns ≈ 0.3 ms per refresh.
- 60 Hz with five frame callbacks is about 1.5 µs per frame.
- Avoid per entry: `sandbox.new`, because each filesystem grant runs `realpath` (module.ae:86 → aether_sandbox.c:510-516); and `enforce`, because of the copy.

**Where the real cost is.** It is in checks made inside a level: path resolution (an `lstat` per path component) plus the audit mutex and two `snprintf`s for each check. Storage operations already do file I/O, so this is small next to them.

**Measure first, before step 6.** Step 4 is a bench page plus a driver-only counter of entries and nanoseconds spent in push/pop, for:
- a datagrid refresh;
- a frame loop;
- 10,000 `ui.after` timers;
- HTTP throughput, because of the permanent actor-step cost described in section 2.

Run it on ae-x64 and a Mac, with and without push/pop (a compile-time constant, removed afterwards).

## 5. Tests

**New corpus attempt: `tests/escape/kernel_slip.ts`.** The rule is "the host's own calls during a page entry are held to the page's grants". The attempt uses a probe object, `__sae_probe`, installed only when `SAE_SANDBOX_PROBE=<canary dir>` and `AETHER_UI_TEST_PORT` are set (read at start).

The probe's operations take no arguments from the page:
- `fs()`: `fs.read` of `<canary>/secret`
- `env()`: `os.getenv`
- `tcp()`: `tcp.connect` to the page server
- `exec()`: `os.exec("true")`
- `libc()`: `fopen` through an extern, which only the preload sees
- `depth()`: the number of levels in force

The page calls these in every kind of entry and reports "kernel_slip: refused: …" or "ESCAPED":
- first run;
- a click handler;
- `setTimeout` and `setInterval`;
- a frame callback;
- a promise job;
- an HTTP callback;
- a conversion entry (a context-menu items getter, as `menu_getter.ts` does).

The kernel must print "sae: refused by the sandbox: <category> <resource>" exactly once per page per resource. That bumps `spec_escape` from 19 to 20 attempts.

**App mode: `tests/apps/sandbox` and `spec_app_sandbox`.**
- The same probe from bus, backend and SQLite deliveries.
- Positive controls: the probe reading inside an `fs` grant is allowed; storage, `fs` and documents still work.

**Existing attempts.**
- `other_storage` and `cap_storage` gain a second line of defence. Prove it by mutation: disable `storage_key_ok_` and the sandbox must still refuse `../http___localhost_8091/token`.
- `climb`, `import_url`, `other_origin`, `redirect_out`, `mixed_content` and `forge_allow_origin` are not covered: they happen during navigation or on the HTTP actors. Say so in the README.

**Proof that each entry kind is enforced.** `depth() > 0` and the canary refused in every entry kind. Removing the push must make the spec fail.

**Structural check: `tests/check_page_sandbox.sh`.**
- `sandbox_push`/`sandbox_pop` (or `pagegrants.enter`/`leave`) appear only in the entry-helper block.
- Every kernel tick starts with the guard.
- `env_(` appears only in a listed set of startup functions.
- `services/pagegrants` is in `check_layers.sh` (import list `std.sandbox|std.string|std.strarr`) and in the `hide` line of the veto (check_page_veto.sh).

**`tests/run_all.sh`.** Fail on any "refused by the sandbox" line in `target/run_all` logs except the probe's.

**LD_PRELOAD lane.** `run_spec.sh` gets `SAE_TEST_PRELOAD=<path>/libaether_sandbox.so`. It sets `LD_PRELOAD` and `AETHER_SANDBOX_LOG=stderr` on sae-driver only: not on the page server or `ae run`, and never `AETHER_SANDBOX_GRANTS`. `spec_app_channel` needs it passed through as well. `run_all.sh` passes it on.

Run it on ae-x64 (Ubuntu 22.04) and the N100 with `SAE_TEST_WAIT_SCALE=6` and a raised `SAE_PAGE_TIME_MS` where AGENTS.md says. Run FreeBSD the same way, under run_all's own Xvfb, when the host is back. `probe.libc()` must be refused only on these lanes.

## 6. Steps (each one keeps every existing suite green)

0. **Probes.**
   - **P1:** a 20-line program in a scratch directory: push and pop builtins from a non-std module; a read refused; then a grant added to the live list makes the read allowed.
   - **P2:** P1 under `LD_PRELOAD` with no grant file, using an extern `fopen`; plus `nm -D target/build/bin/sae-driver | grep aether_sandbox_check_resolved`.
   - **P3:** unmodified sae-driver under the preload, running `run_all`. This shows the effect of `syscall()` returning ENOSYS on GLib and Mesa.
   - **P4:** the audit API's cost.
   - **P5:** FreeBSD repeat of P2 and P3.
1. **Hoist environment reads and paths out of entries.** Cache `page_time_ms`, the clock scale (332) and the coarse-clock setting (5805). Add `p.storage_dir`, made and created in `page_new_`; today `storage_dir_` reads `HOME` and calls `realpath` on every call (9486-9533). Proof: the structural check above, suites green.
2. **Find the page from its runtime** (Aether PR plus a pin bump, or pass `p` through). Proof: `check_timed_entries.sh` and the suites.
3. **`p.entry_depth`, `b.entry_depth` and the kernel-tick guard.** Proof: the structural check.
4. **The bench** (section 4).
5. **`services/pagegrants`.** Builds the lists and checks that each is within the browser's limit. Proof: a windowless `tests/spec_page_grants.ae` for browser, file and app pages, and `absent`.
6. **Enforcement.** Push and pop, with an empty deny-all list in place of null, and documents added to the live list. Proof: `kernel_slip`, `run_all` with zero unexpected refusals, and the mutation run.
7. **Audit reporting, once per page.** Proof: `spec_escape`'s "logged once".
8. **`spec_app_sandbox`.**
9. **Move dialogs, URL opening and clipboard reads out of entries.** Proof: `spec_app_documents`, clipboard, gitify, pomatez and print specs green.
10. **The LD_PRELOAD lane on ae-x64 and the N100, with the toolkit read set.**
11. **FreeBSD lane.** Amend the roadmap: Capsicum moves to item 5.
12. **Optional:** `enforce` in `http_do_` for app-mode hosts. This needs grants for resolver files and the TLS trust store.

Then update architecture.md (stage 3), the README rules and roadmap 1.3.

**Risks and open questions**
- Risks 1-3 in the summary (P3, P2, nested loops).
- **Silent wrong behaviour.** A refused call looks like a missing file or variable, for example storage silently landing in `./.sae`. Steps 1 and 6 guard against it with the `run_all` assertion.
- **Whether calling `sandbox_push`/`sandbox_pop` directly from Aether is a supported API.** containment-sandbox.md:264-267 blesses it for C hosts only. Ask Aether for `sandbox.enter`/`leave`.
- **The audit ring is global, 256 entries, behind one mutex, with no monotonic denial counter.** Denials can be lost if it wraps within one entry. Ask Aether for a counter.
- **Two live pages nesting** would intersect their grants.
- **Windows.** Unverified whether grant patterns made absolute with `_fullpath` match `slashes_` paths.
- **Under the preload, toolkit opens inside entries** (gdk-pixbuf `loaders.cache`, fonts, `xdg-open`, CUPS) will break until granted or moved out. The size of that read set is unverified.

### Critical Files for Implementation
- /Users/paul/scm/sae/src/sae_host.ae (9673-9810, 432-455, 3986-4200, 5236-5265, 9486-9533, 10247, 10817-10839)
- /Users/paul/scm/aether/runtime/aether_sandbox.c
- /Users/paul/scm/aether/std/sandbox/module.ae
- /Users/paul/scm/aether/runtime/libaether_sandbox_preload.c
- /Users/paul/scm/sae/tests/check_timed_entries.sh and /Users/paul/scm/sae/tests/spec_escape.ae
