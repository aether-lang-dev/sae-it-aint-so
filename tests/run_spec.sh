#!/bin/sh
# tests/run_spec.sh — run a sae browser spec: Tsyne's addPages() +
# createBrowser() + cleanup(), as a launcher.
#
#   tests/run_spec.sh [spec] [site-dir]     (defaults: spec_nav, site/)
#   SAE_TEST_APP=<dir> tests/run_spec.sh <spec>   app mode: sae-driver --app <dir>
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
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SITE=$(cd "${2:-$ROOT/site}" && pwd)
SITE_PORT="${SAE_TEST_SITE_PORT:-8091}"
DRIVER_PORT=9222

# Same toolchain choice as build.sh: an Aether dev tree beside sae wins.
if [ -z "${SAE_AETHER_HOME:-}" ] && [ -f "$ROOT/../aether/build/libaether.a" ]; then
    SAE_AETHER_HOME=$(cd "$ROOT/../aether" && pwd)
fi
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"

for f in target/pageserver target/build/bin/sae-driver; do
    [ -x "$ROOT/$f" ] || {
        echo "run_spec.sh: no $f; build it with AETHER_UI_WITH_DRIVER=1 ./build.sh (see README)" >&2
        exit 2
    }
done
if curl -s -o /dev/null "http://127.0.0.1:$DRIVER_PORT/widgets"; then
    echo "run_spec.sh: something already answers on driver port $DRIVER_PORT" >&2
    exit 2
fi

LOG="$ROOT/target/$SPEC.log"
# The page server runs in both modes: in app mode it is the API an app may
# call (its /api/ routes).
"$ROOT/target/pageserver" "$SITE" "$SITE_PORT" >/dev/null 2>&1 &
SERVER=$!
if [ -n "${SAE_TEST_APP:-}" ]; then
    AETHER_UI_TEST_PORT=$DRIVER_PORT "$ROOT/target/build/bin/sae-driver" \
        --app "$(cd "$SAE_TEST_APP" && pwd)" >"$LOG" 2>&1 &
else
    AETHER_UI_TEST_PORT=$DRIVER_PORT "$ROOT/target/build/bin/sae-driver" \
        "http://127.0.0.1:$SITE_PORT/" >"$LOG" 2>&1 &
fi
SAE=$!
trap 'kill $SAE $SERVER 2>/dev/null || true' EXIT INT TERM

cd "$ROOT/tests"
status=0
env AETHER_LIB_DIR="$ROOT/tests/lib:$ROOT/aether-ui/tests/lib" \
    SAE_TEST_BASE="http://127.0.0.1:$SITE_PORT" SAE_TEST_LOG="$LOG" \
    ae run "$SPEC.ae" || status=$?
exit $status
