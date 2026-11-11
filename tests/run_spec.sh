#!/bin/sh
# tests/run_spec.sh — run a sae browser spec: Tsyne's addPages() +
# createBrowser() + cleanup(), as a launcher.
#
#   tests/run_spec.sh [spec] [site-dir]     (defaults: spec_nav, site/)
#   SAE_TEST_APP=<dir> tests/run_spec.sh <spec>   app mode: sae-driver --app <dir>
#   SAE_TEST_START=<url|file> tests/run_spec.sh <spec>   the browser, starting there
#   SAE_TEST_SERVER=external tests/run_spec.sh <spec>   use a page server that
#       already answers on SAE_TEST_SITE_PORT (one in a container, WSL, another
#       host's) instead of starting target/pageserver
#   SAE_TEST_BIN=<sae-driver> tests/run_spec.sh <spec>   another sae-driver: an
#       app's own host, built by tools/saehost.sh with its natives (docs/natives.md)
#   SAE_TEST_PARENT=1 SAE_TEST_APP=<dir> tests/run_spec.sh <spec>   the spec
#       starts sae-driver itself, as the program that drives it over
#       --control-stdio (sdk/saecontrol): it is given SAE_TEST_DRIVER_BIN,
#       SAE_TEST_APP_DIR, AETHER_UI_TEST_PORT and SAE_TEST_LOG, and stops
#       what it starts; the spec's stderr, which sae inherits, is appended
#       to SAE_TEST_LOG
#   tests/run_spec.sh /path/to/spec_x.ae [site-dir]   a spec of another repo's
#       (an app built on sae, such as ../spraedsheet); its own
#       test libraries go first on the module path with SAE_TEST_LIB_DIR.
#
# Starts target/pageserver on the site directory and sae-driver (built with
# `AETHER_UI_WITH_DRIVER=1 ./build.sh`) pointed at it, on the AetherUIDriver
# port uidriver.ae expects (9222). Then runs tests/<spec>.ae with
# saedriver.ae and aether-ui's uidriver.ae on the module path, stops both
# processes, and exits with the spec's status.
#
# sae-driver's output goes to target/<spec>.log; saedriver's console_*
# verbs read it (SAE_TEST_LOG).
set -e
SPEC="${1:-spec_nav}"
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
# A spec named by its path (another repo's) runs where it is.
SPEC_DIR="$ROOT/tests"
case "$SPEC" in
    */*) SPEC_DIR=$(cd "$(dirname "$SPEC")" && pwd); SPEC=$(basename "$SPEC" .ae) ;;
esac
SITE=$(cd "${2:-$ROOT/site}" && pwd)
SITE_PORT="${SAE_TEST_SITE_PORT:-8091}"
DRIVER_PORT="${AETHER_UI_TEST_PORT:-9222}"

# One spec at a time per machine: the page server and the driver bind fixed
# ports (the app specs' app.json lists 8091), so concurrent runs -- several
# worktrees, several agents -- would collide. A mkdir lock is atomic on every
# platform sae builds on (macOS has no flock); a stale lock from a killed run
# is reclaimed after 10 minutes.
LOCK="${TMPDIR:-/tmp}/sae-run_spec.lock"
_now() { date +%s; }
while ! mkdir "$LOCK" 2>/dev/null; do
    if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; continue; fi
    sleep 1
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM

# Same toolchain choice as build.sh: an Aether dev tree beside sae wins.
if [ "${SAE_AETHER_HOME:-}" = none ]; then
    unset SAE_AETHER_HOME
elif [ -z "${SAE_AETHER_HOME:-}" ] && [ -f "$ROOT/../aether/build/libaether.a" ]; then
    SAE_AETHER_HOME=$(cd "$ROOT/../aether" && pwd)
fi
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"

DRIVER_BIN="${SAE_TEST_BIN:-$ROOT/target/build/bin/sae-driver}"
EXTERNAL_SERVER=0
[ "${SAE_TEST_SERVER:-}" = external ] && EXTERNAL_SERVER=1
for f in target/pageserver; do
    [ $EXTERNAL_SERVER = 1 ] && break
    [ -x "$ROOT/$f" ] || {
        echo "run_spec.sh: no $f; build it with AETHER_UI_WITH_DRIVER=1 ./build.sh (see README)" >&2
        exit 2
    }
done
[ -x "$DRIVER_BIN" ] || {
    echo "run_spec.sh: no $DRIVER_BIN; build it with AETHER_UI_WITH_DRIVER=1 ./build.sh (see README)" >&2
    exit 2
}
if curl -s -o /dev/null "http://127.0.0.1:$DRIVER_PORT/widgets"; then
    echo "run_spec.sh: something already answers on driver port $DRIVER_PORT" >&2
    exit 2
fi

LOG="$ROOT/target/$SPEC.log"
# A page's JS entries are stopped after 5 s in use; 1 s here keeps the
# spec that loops forever quick.
export SAE_PAGE_TIME_MS="${SAE_PAGE_TIME_MS:-1000}"
# The page server runs in both modes: in app mode it is the API an app may
# call (its /api/ routes).
SERVER=
if [ $EXTERNAL_SERVER = 1 ]; then
    curl -s -o /dev/null "http://127.0.0.1:$SITE_PORT/" || {
        echo "run_spec.sh: SAE_TEST_SERVER=external, but nothing answers on http://127.0.0.1:$SITE_PORT/" >&2
        exit 2
    }
else
    # Another server already answering there would take the requests (on
    # Windows a WSL container's 127.0.0.1 relay wins over this 0.0.0.0), and
    # the spec would run against its state, not this site's.
    if curl -s -o /dev/null "http://127.0.0.1:$SITE_PORT/"; then
        echo "run_spec.sh: something already answers on page server port $SITE_PORT (SAE_TEST_SERVER=external to use it)" >&2
        exit 2
    fi
    "$ROOT/target/pageserver" "$SITE" "$SITE_PORT" >/dev/null 2>&1 &
    SERVER=$!
    # Wait for it to answer before sae loads its first page: a freshly built
    # page server's first start (macOS checks a new binary first) lost that
    # race, and spec_nav's home page read "connection failed" (2026-11-11).
    i=0
    while [ $i -lt 100 ] && ! curl -s -o /dev/null "http://127.0.0.1:$SITE_PORT/"; do
        sleep 0.1; i=$((i + 1))
    done
fi
SAE=
if [ -n "${SAE_TEST_PARENT:-}" ]; then
    export SAE_TEST_DRIVER_BIN="$DRIVER_BIN" AETHER_UI_TEST_PORT=$DRIVER_PORT
    [ -n "${SAE_TEST_APP:-}" ] && export SAE_TEST_APP_DIR="$(cd "$SAE_TEST_APP" && pwd)"
    : >"$LOG"
elif [ -n "${SAE_TEST_APP:-}" ]; then
    AETHER_UI_TEST_PORT=$DRIVER_PORT "$DRIVER_BIN" \
        --app "$(cd "$SAE_TEST_APP" && pwd)" ${SAE_TEST_FLAGS:-} >"$LOG" 2>&1 &
else
    AETHER_UI_TEST_PORT=$DRIVER_PORT "$DRIVER_BIN" \
        "${SAE_TEST_START:-http://127.0.0.1:$SITE_PORT/}" >"$LOG" 2>&1 &
fi
[ -n "${SAE_TEST_PARENT:-}" ] || SAE=$!
trap 'kill $SAE $SERVER 2>/dev/null || true; rmdir "$LOCK" 2>/dev/null' EXIT INT TERM

cd "$SPEC_DIR"
status=0
if [ -n "${SAE_TEST_PARENT:-}" ]; then
    env AETHER_LIB_DIR="${SAE_TEST_LIB_DIR:+$SAE_TEST_LIB_DIR:}$ROOT/tests/lib:$ROOT/aether-ui/tests/lib:$ROOT:$ROOT/sdk" \
        SAE_TEST_BASE="http://127.0.0.1:$SITE_PORT" SAE_TEST_LOG="$LOG" \
        ae run "$SPEC.ae" 2>>"$LOG" || status=$?
else
    env AETHER_LIB_DIR="${SAE_TEST_LIB_DIR:+$SAE_TEST_LIB_DIR:}$ROOT/tests/lib:$ROOT/aether-ui/tests/lib:$ROOT:$ROOT/sdk" \
        SAE_TEST_BASE="http://127.0.0.1:$SITE_PORT" SAE_TEST_LOG="$LOG" \
        ae run "$SPEC.ae" || status=$?
fi
exit $status
