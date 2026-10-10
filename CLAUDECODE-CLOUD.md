# Working on sae in a Claude Code cloud session

A cloud session starts in a fresh Linux container holding only this
repository. sae builds against three sibling checkouts (`../aether`,
`../aether-ui`, `../aeb`) and two C amalgamations, so the first few minutes
go on getting those. This file says what happens on its own, what to do by
hand, and the one hack involved. The first session's full account is
[docs/claudecode-cloud-experience-report.md](docs/claudecode-cloud-experience-report.md).

## What the session hook does

`.claude/settings.json` runs `tools/setup-siblings.sh --hook` at session
start. It does nothing unless `CLAUDE_CODE_REMOTE=true`, so a local session
never runs it. In the cloud it:

1. clones whichever sibling is missing, shallow, at the refs in `pins`
   (aether at tag `v$AE_PIN`, aether-ui at `AETHER_UI_REF`, aeb at
   `AEB_REF`). All three are public, and the session's git proxy serves
   anonymous clones of public GitHub repositories, though its GitHub API
   scope is this repository only;
2. puts a SQLite amalgamation in place when `www.sqlite.org` is blocked
   (below);
3. builds aether (`make compiler ae stdlib contrib`) and fetches the QuickJS
   amalgamation, which comes from GitHub releases and downloads fine;
4. installs aeb into `target/toolchain`, with `../aether/build` on `PATH`
   (aeb's install runs `ae`).

Logs go to `target/setup-siblings/`. A failure is reported and the session
carries on without the siblings; run `tools/setup-siblings.sh` again by hand
to retry. A sibling the script did not clone is never touched.

## SQLite: the npm hack

aether's `contrib.sqlite` compiles the SQLite amalgamation from source.
`scripts/fetch-sqlite-amalgamation.sh` downloads the zip pinned in
`contrib/sqlite/amalgamation.lock` from `www.sqlite.org`, which the cloud
network policy blocks (403). If that fetch fails, `make contrib` quietly
falls back to the system `libsqlite3`, which the container may not have.

The npm registry is reachable, and the `better-sqlite3` package carries a
SQLite amalgamation under `deps/sqlite3/`. When sqlite.org does not answer,
the hook copies that package's current `sqlite3.c`, `sqlite3.h` and
`sqlite3ext.h` into `../aether/contrib/sqlite/amalgamation/`. It writes the
pin's hash into `.sha256` there, so the fetch script keeps the copy rather
than retrying the download. `.source` records the copy's origin.

What that copy is and isn't:

- **Not the pinned source.** The version is whatever `better-sqlite3`'s
  latest release bundles, not necessarily the lock's, and the lock's
  SHA-256 was never checked against it. sae only needs a recent SQLite with
  FTS5 and the math functions, so the version doesn't matter. When checked
  (better-sqlite3 13.0.3, 2026-10-10) it was 3.53.4, the lock's own
  version. Its `sqlite3.h` and `sqlite3ext.h` were byte-identical to the
  pinned zip's. Its `sqlite3.c` differed only in the parser, which
  better-sqlite3 regenerates with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`. Its
  other build options are compile flags, and aether's `SQLITE_CFLAGS` apply
  instead.
- **For building and testing in the container only.** Nothing built from
  it ships, and it is never committed (the directory is gitignored in
  aether).
- **Local sessions don't use it.** On a workstation `../aether` is a
  working copy, so the hook doesn't touch it.

The proper fixes are to allow `www.sqlite.org` in the environment's network
policy, or for aether's lock to name a mirror. Until one of those lands, the
hack is good enough.

To do it by hand (a `../aether` you cloned yourself, say):

```sh
amal=../aether/contrib/sqlite/amalgamation
tgz=$(curl -fsSL https://registry.npmjs.org/better-sqlite3/latest |
    sed -n 's/.*"tarball":"\([^"]*\)".*/\1/p')
mkdir -p "$amal" && curl -fsSL "$tgz" | tar xzf - -C /tmp package/deps/sqlite3
cp /tmp/package/deps/sqlite3/sqlite3*.[ch] "$amal"/
(. ../aether/contrib/sqlite/amalgamation.lock; echo "$SQLITE_SHA256") >"$amal/.sha256"
make -C ../aether contrib
```

## What still needs doing by hand

- **System packages.** The hook installs none. The browser (`./build.sh`,
  GTK4 on Linux) needs `libgtk-4-dev` and `libepoxy-dev`, and the specs need
  `xvfb` (`apt-get install` works in the container). The headless half
  needs neither: `lower/run-tests.sh`, `saelower`, `saejs` and the
  `tests/check_*` scripts.
- **Driver specs.** Build the browser with its driver
  (`AETHER_UI_WITH_DRIVER=1 ./build.sh`) and the page server
  (`(cd tools && ../../aether/build/ae build pageserver.ae -o ../target/pageserver)`),
  then `xvfb-run -a tests/run_spec.sh <spec>`. A spec with no window, such
  as `tests/spec_sqlite_service.ae`, runs with `ae run` from sae's root
  (`AETHER_HOME=../aether`, `../aether/build` on `PATH`). If a spec was only written in the cloud, run it
  on a Mac too before trusting its pixel coordinates.

## Working well in a container

- Keep a demo's logic in modules with no `ui` or `vg` (`site/algos/` is the
  model). The lowerer's module harness (`lower/tests/mod/`) runs those
  modules headless on `saejs`, so most of a demo's tests run without a
  window.
- A page can be smoke-run on `saejs` with stub `ui`/`vg` globals, which is
  enough to check its event flow before a browser is available.
- Before committing a lowerer change, run `lower/run-tests.sh`, and compare
  old and new lowerer output over every tracked `.ts` file.
