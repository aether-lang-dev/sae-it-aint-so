# sae on FreeBSD

sae builds and runs on FreeBSD on aether-ui's GTK4 backend, the same backend
as Linux. First run in full on 2026-11-20 on the lab host `ghostbsd`
(GhostBSD, FreeBSD 15.1-RELEASE amd64, clang 19, GTK 4.20.4), with Aether
from the pinned release's `freebsd-x86_64` binary, aeb v0.347, and
aether-ui at `AETHER_UI_REF`.

## Packages

```sh
pkg install git curl gmake bash gtk4 libepoxy pkgconf xorg-vfbserver lsof
pkg install node24 python3       # spraedsheet's REXX, MCP, cli and real-keys tests; check_gate's tsc
pkg install xdotool              # spraedsheet's real_keys_x11 (optional)
```

`xorg-vfbserver` is `Xvfb`, for the specs on a machine with no display.
`lsof` is how `tests/lib/listeners.sh` sees what a process listens on
(FreeBSD mounts no `/proc`). The build uses the system `cc` (clang); gcc is
not needed. bash is only for the scripts that ask for it; sae's own are
`/bin/sh`.

## Building

`bootstrap.sh` and `./build.sh` work unchanged. aeb's `get.sh` picks the
`aether-<pin>-freebsd-x86_64.tar.gz` release asset, so no compiler is built
from source:

```sh
./bootstrap.sh          # ae and aeb into ~/.local (PREFIX=... for elsewhere), ../aether-ui at its pin
./build.sh                                   # target/build/bin/sae
AETHER_UI_WITH_DRIVER=1 ./build.sh           # target/build/bin/sae-driver
(cd tools && ae build pageserver.ae -o ../target/pageserver)
ae build tools/saelower.ae -o target/saelower
ae build tools/saejs.ae -o target/saejs
ae build tools/saebus.ae -o target/sae-bus
ae build tools/saegate.ae -o target/saegate
```

Leave `AETHER_HOME` unset (or pointing at that install) and set
`SAE_AETHER_HOME=none` if an older Aether dev tree sits at `../aether`. On a
host shared with other builds, give `ae` a cache of its own
(`AETHER_CACHE_DIR`): a link once failed when another user cleared
`~/.aether/cache` in the middle of it.
Each `./build.sh` takes about two minutes on four threads of an i3-8109U.

## Testing

```sh
lower/run-tests.sh                           # headless
tests/run_all.sh                             # starts its own Xvfb (no xvfb-run on FreeBSD)
```

With no `DISPLAY`, `tests/run_all.sh` starts an `Xvfb` of its own
(1920x1200, `-displayfd` picks a free display) and stops it on exit;
spraedsheet's `./run-tests.sh` does the same. A script run on its own that
opens a window, even with `SAE_NO_WINDOW=1` (`tests/check_gate.sh` runs sae
for its page dumps), needs a display as on Linux: run it from `run_all.sh`
or under an Xvfb of your own. Beside another checkout's run, move the ports
(`SAE_TEST_SITE_PORT`, `AETHER_UI_TEST_PORT`) as AGENTS.md says.

### What passes (2026-11-20, ghostbsd)

| Suite | FreeBSD (ghostbsd) | Linux (cachyos) |
|---|---|---|
| `lower/run-tests.sh` | 97 of 97 | 97 |
| `tests/run_all.sh` | 97 of 97 rows | 97 rows |
| the check scripts alone (`check_gate` with tsc, `check_layers`, `check_page_veto`, `check_page_sandbox`, `check_timed_entries`) | all pass | all pass |
| spraedsheet `./run-tests.sh` | 13 of 13 rows, `real_keys_x11` (xdotool) among them | 12 entries, `real_keys_x11` skipped without xdotool |

The first full run (Aether 0.923.0) passed 92 of 97; the five that failed
were the specs' Linux assumptions, now stated per platform (below). On
0.926.0 `spec_nav` showed a race of the spec's own (a Reload asserted
before the page was rebuilt), fixed in the spec. `spec_app_rexxconsole`
needs `../RexxAE` beside sae.

## What differs, and what the specs assert there

**A contained socket backend.** Aether's `sandbox.spawn_socket` holds a
child on Linux with Landlock and seccomp. On FreeBSD it has the preload
library and, for an Aether child, Capsicum (`AETHER_CAPSICUM=1`), but nothing
that holds a foreign program, so it refuses ("cannot contain a child on
FreeBSD yet (no kernel layer for a foreign program)") and starts nothing.
sae fails closed with it: an app whose backend has `"channel": "socket"`
and a `"sandbox"` is not started, and says why. So:

- `spec_app_backend_socket` asserts the refusal, in Aether's words for
  FreeBSD, and `spec_backend_socket_service` asserts that nothing starts.
- `spec_app_docstats`, `spec_app_rexxconsole` and `spec_app_treewalk` run
  with `--uncontained-backend` off Linux (`tests/run_all.sh` adds it), as the
  apps' READMEs say, and assert sae's "not contained (--uncontained-backend)".
  docstats and rexxconsole lock themselves down (`sandbox.enforce` with no
  grants), so the path and ADDRESS refusals still hold; treewalk has no
  lockdown of its own, and its spec asserts that `/etc`, outside app.json's
  grants, is walked there: nothing holds it to them.

**The page sandbox.** The in-process layer (std's file, environment, exec
and tcp checks during a page's entries) is pure C and the same as on Linux;
`spec_escape` (the probe's reads, writes, connects, exec and environment,
refused and logged once) and `spec_app_sandbox` pass. sae's own process has
no kernel layer on FreeBSD, as on Linux (docs/design/page-entry-sandbox.md).

**Geometry.** GTK 4.20 with FreeBSD's fonts lays windows out at sizes that
differ from Linux's (examples/fractals' canvas is 360x313). A spec that
clicks a whole canvas pixel predicts what the page receives from that
pixel (`saedriver.vg_vb_x/vg_vb_y`), not from the viewBox point it aimed at.

**Loopback buffers.** FreeBSD's TCP loopback starts at 32 KiB sent and
64 KiB received and grows only as the reader reads, where Linux's is far
larger. aether-ui's driver used to write its answer from the UI thread, so
a large answer (spraedsheet's /widgets, 345 KB) forwarded by sae's control
bus, which reads it on that same thread, could not be read until the
driver's send timed out: the bus answered "the UI driver did not answer in
10 s". The driver now writes its answers from its own thread (aether-ui's
CHANGELOG).

**Scripts.** sae's scripts are POSIX `sh` and already avoid GNU-only forms
(`sha256sum`/`shasum`, `date -d`/`date -v`, `sed -i.rt`, `/proc` with an
`lsof` fallback, `nproc`/`sysctl hw.ncpu`). `bash` is `/usr/local/bin/bash`
on FreeBSD, so a script that needs it must say `#!/usr/bin/env bash`, or be
run as `bash script`: RexxJS's `core/rexx` says `#!/bin/bash`, so
spraedsheet's REXX spec runs it with the bash on PATH.
