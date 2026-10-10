# Claude Code in the cloud: an experience report

Written by Claude on 2026-10-10, after building demo 17 (Algorithm theatre,
`site/algos.ts`) in a Claude Code cloud session: a fresh Linux container
holding only this repository, on branch `claude/typescript-grammar-demo-dd78nj`.
It records what worked, what got in the way, and what would make the next
cloud session on sae faster.

## The short version

- The headless half of sae's toolchain (Aether, `saelower`, `saejs`,
  `lower/run-tests.sh`, the `check_*` scripts) builds and runs on Linux in
  the container after about four fixes, all listed below.
- The browser (`sae`, `sae-driver`) does not build: `.build.ae` has only the
  macOS arm. So no `tests/run_spec.sh` spec can run in the cloud yet, and
  `tests/spec_algos.ae` was compiled but never run.
- Most of what the demo needed could still be tested here. The logic lives in
  modules with no `ui` or `vg` (`site/algos/`), which run headless through the
  lowerer's module harness. The page itself was run on `saejs` against
  stub `ui`/`vg` globals.
- Building a TypeScript showcase found three real bugs, now fixed in
  `d2c9cce`: nested type arguments (`Map<string, Set<number>>`) did not
  lower at all; a union type written one `| {...}` per line was cut short;
  and `run-tests.sh` recursed forever on a module it could not read.

## Getting a toolchain

The container starts with only `sae-it-aint-so`. The README's siblings
(`../aether`, `../aether-ui`, `../aeb`) are missing.

1. **Siblings.** All three repositories are public, and the session's git
   proxy serves anonymous clones of public GitHub repositories, so a
   `git clone --depth 1` of each next to sae worked. (The session's GitHub
   *API* scope is this repository only, but cloning does not need it.)
2. **Aether.** `make compiler ae stdlib contrib` in `../aether` built
   cleanly. But building `saelower` then failed:
   `amalgamation/quickjs-amalgam.c: No such file or directory`. The QuickJS
   amalgamation is fetched by `scripts/fetch-quickjs-amalgamation.sh`, which
   I had to run by hand (from GitHub releases; that download worked).
3. **SQLite.** `scripts/fetch-sqlite-amalgamation.sh` got a 403: the
   environment's network policy blocks `www.sqlite.org`. Workaround: the
   npm registry is reachable, and `better-sqlite3`'s package carries the
   SQLite amalgamation under `deps/sqlite3/`. Its `SQLITE_VERSION` matches the
   pin (3.53.4). The pin's SHA-256 is for the zip, which I never had, so this
   copy is unverified against `amalgamation.lock`. Fine for building
   locally; it should never ship.
4. **aeb.** `make -C ../aeb install PREFIX=$PWD/target/toolchain`, as
   AGENTS.md says, failed with `ae: No such file or directory`. It needs
   `../aether/build` on `PATH` (and `AETHER_HOME`) first.
5. **GTK4.** `libgtk-4-dev` was not installed; `apt-get install` worked.
   `Xvfb` and `xvfb-run` were already there.
6. **sae itself.** `AETHER_UI_WITH_DRIVER=1 ./build.sh` failed:
   `gcc: error: unrecognized command-line option '-fobjc-arc'`.
   `.build.ae` always compiles `aether_ui_macos.m` with the AppKit
   frameworks, and the README already lists the GTK4 arm as not done. With
   no `sae-driver`, none of the 45+ browser specs can run in a Linux
   container, even under Xvfb.

## How the work was tested without a browser

The plan followed the test pyramid, and the missing browser made that
layering essential rather than optional:

- **Unit, headless (most of the tests).** `lower/tests/mod/algos_*.ts`
  import the real modules through a symlink (`lower/tests/mod/algos` →
  `site/algos`), so the harness resolves them as it does `./lib/*.ts`.
  The checks:
  - every algorithm over 6 sizes × 12 seeds sorts its input;
  - replaying its step stream on a copy gives the same result;
  - it marks each index sorted exactly once;
  - its counts on sorted and reversed input are the textbook's;
  - Lane, Runner and Race behave as specified when tested against
    `lib/check.ts`'s `mock()`, a Proxy that records calls the way Mockito's
    `verify` reads them.

  All of it runs on sae's own engine (QuickJS via `saejs`), not Node.
- **Integration, headless (ad hoc, not committed).** The page and its
  modules were lowered as the browser lowers them, bundled behind
  `harness.js` with stub `ui`, `vg`, `state`, `bind` and
  `requestAnimationFrame`, then driven: Step, Run, 40 frames, picker,
  Shuffle. It printed the same step counts the headless tests pin, ended
  with every bar green and in order, and showed bar heights and colours as
  `vg.set` received them.
- **End to end.** `tests/spec_algos.ae` is written against the driver verbs
  `spec_life.ae` uses, and compiles with `ae build`. It has never run.
  **On a Mac, run `tests/run_spec.sh spec_algos` before trusting it.** The
  pixel coordinates were checked by hand against the smoke run's geometry,
  not against a rendered canvas.

Regression safety for the lowerer change: the `HEAD` lowerer was built in a
worktree, and both lowerers were run over all 177 tracked `.ts` files.
Every output was identical, so the fix changes only inputs that used to fail.

## Friction worth fixing

| What | Cost here | Suggestion |
|---|---|---|
| No Linux arm in `.build.ae` | No browser spec runs in the cloud | The GTK4 arm already on the README's list; Xvfb is present for it |
| Siblings not in the container | Three clones by hand | A SessionStart hook (or the environment's setup script) that clones them |
| `make contrib` leaves the QuickJS amalgamation unfetched in a dev tree | A failed build, then a search | Have `build.sh` (or the hook) run the fetch script when the file is missing, as its comment implies it does |
| `sqlite.org` blocked by network policy | A substitute amalgamation from npm, unverified | Allow `www.sqlite.org` in the environment's network policy, or host the pinned zip on GitHub releases |
| aeb's install needs `ae` on `PATH` | One failed install | One line in AGENTS.md's install snippet |
| `run-tests.sh` recursing on a lowering error | `Maximum function recursion depth` and no hint why | Fixed in `d2c9cce` |

## What went well

- `lower/run-tests.sh` makes the lowerer easy to change with confidence:
  a page with `// expect:` lines is a test, and the line-count check catches
  any edit that shifts positions.
- Because pages are modules, the demo could be split into a pure core and a
  thin view, and only the view needs a window. Future demos (Reversi, 2048,
  TodoMVC's model) can follow the same split and get most of their tests
  in the cloud for free.
- Using the dialect in earnest found real bugs fast. Nested generics are
  everyday TypeScript, and no existing page used them. A showcase demo
  doubles as a conformance test.

## Second session: the spreadsheet (demo 18), same day

By then `main` had a GTK4 arm in `.build.ae` (`7a27d02`) and the
SessionStart hook (`8af8c74`, `CLAUDECODE-CLOUD.md`). This session's
container was the first one's, so the hook found its siblings already
there. The only setup left was `apt-get install libepoxy-dev`, the one
package the first session had not installed; then
`AETHER_UI_WITH_DRIVER=1 ./build.sh` built `sae-driver` in about 40 s.

- **The browser specs run in the cloud.** `xvfb-run -a tests/run_spec.sh
  spec_algos` passed 5/5, so demo 17's spec, written blind in the first
  session, is now verified. Its pixel coordinates were right.
- **Demo 18 was written and verified end to end in the container.** The
  model (`site/sheet/`) is tested headless first: 3 new module tests, 69 in
  `lower/run-tests.sh`. Then `spec_sheet` ran in the real browser under
  Xvfb: 8 specs, 6 passing on the first run. The two failures were
  assertions I got wrong (what follows the grid, and which cell was still
  selected), not the page.
- **Screenshots close the loop.** The driver's `screenshot` verb, run from
  a throwaway spec, showed that the first layout overflowed the 800 px
  window (columns G to J and everything below the grid were off-screen),
  which no assertion would have caught. A stylesheet class for the cells
  (smaller font, square corners, no `equal_cells`) fixed it, and the next
  screenshot showed all ten columns.
- **One spec_nav test fails on `main` too.** "a page with scoped seeks
  makes the requests it names and no others" (`site/scoped.ts`): the page
  shows its label but none of its buttons. It fails identically with this
  work stashed, so it predates it; it was not looked into here.
- **Nothing in the dialect broke this time.** Six modules exercised
  `#private` fields with definite assignment (`#tok!: Token`), template
  literal types, `Uppercase<>`, intersections of unions, type predicates,
  `satisfies never` and `as const` tuples, and all of them lowered.
