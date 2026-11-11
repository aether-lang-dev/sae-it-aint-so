#!/bin/sh
# tests/run_all.sh -- every spec and check, each with the environment its
# header asks for, one line of PASS/FAIL apiece and a log per run under
# target/run_all/. Exits non-zero when any fails.
#
#   tests/run_all.sh                 everything
#   tests/run_all.sh spec_app_       only the entries whose label contains it
#
# Specs are not interchangeable: an app spec needs SAE_TEST_APP, gitify and
# pomatez their storage and shell logs, local_nav a start page, and three
# specs have no window at all. A loop that ran each through run_spec.sh with
# no environment reported eleven "failures" on Linux that were the loop's
# (2026-10-10); this table is where those requirements live, so add a line
# here with every new spec.
#
# Needs AETHER_UI_WITH_DRIVER=1 ./build.sh, ./build.sh, target/pageserver,
# target/saelower and target/saejs (AGENTS.md "Build and test"). With no display it runs under xvfb-run (Linux) or
# an Xvfb of its own (FreeBSD and the other BSDs, 1920x1200), stopped on exit.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1
FILTER=${1:-}
XVFB_SCREEN="-screen 0 1920x1200x24"
if [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && [ -z "${SAE_RUN_ALL_XVFB:-}" ]; then
    if [ "$(uname -s)" = Linux ] && command -v xvfb-run >/dev/null 2>&1; then
        # A screen named: xvfb-run's own default differs by distribution (640x480
        # on Arch), and the resize specs need room to grow a window to 900x800.
        SAE_RUN_ALL_XVFB=1 exec xvfb-run -a -s "$XVFB_SCREEN" sh "$0" "$@"
    elif [ "$(uname -s)" != Darwin ] && command -v Xvfb >/dev/null 2>&1; then
        # No xvfb-run (FreeBSD, NetBSD, OpenBSD): start an Xvfb of our own.
        # -displayfd lets the server pick a free display number and write it
        # to the descriptor once it is listening; it is stopped on any exit.
        XVFB_FILE=$(mktemp "${TMPDIR:-/tmp}/sae-xvfb.XXXXXX") || exit 2
        # shellcheck disable=SC2086 -- XVFB_SCREEN is a list of words
        Xvfb -nolisten tcp $XVFB_SCREEN -displayfd 3 3>"$XVFB_FILE" >/dev/null 2>&1 &
        XVFB_PID=$!
        trap 'kill "$XVFB_PID" 2>/dev/null; wait "$XVFB_PID" 2>/dev/null; rm -f "$XVFB_FILE"' EXIT
        trap 'exit 130' INT
        trap 'exit 143' TERM HUP
        trap 'exit 141' PIPE
        # A shell killed by a signal it does not trap (SIGKILL, or SIGPIPE when
        # a reader such as `| head` goes) never runs the EXIT trap: a watchdog
        # outside the shell's own stdio stops Xvfb once this shell is gone.
        ( while kill -0 $$ 2>/dev/null; do sleep 1; done; kill "$XVFB_PID" 2>/dev/null ) \
            </dev/null >/dev/null 2>&1 &
        n=0
        while [ ! -s "$XVFB_FILE" ]; do
            n=$((n + 1))
            if [ "$n" -gt 100 ] || ! kill -0 "$XVFB_PID" 2>/dev/null; then
                echo "run_all.sh: Xvfb did not start" >&2; exit 2
            fi
            sleep 0.1
        done
        DISPLAY=:$(head -n 1 "$XVFB_FILE"); export DISPLAY
    fi
fi
for f in target/build/bin/sae target/build/bin/sae-driver target/pageserver target/saelower target/saejs; do
    [ -x "$f" ] || { echo "run_all.sh: no $f (AGENTS.md \"Build and test\")" >&2; exit 2; }
done
# A binary older than the sources it is built from tests old code, and passes
# or fails for reasons that are not the tree's (2026-11-11: a sae-driver from
# before --control-stdio failed every spec_app_channel case). The specs drive
# sae-driver; sae is built alongside it.
for f in target/build/bin/sae target/build/bin/sae-driver; do
    newer=$(find -H .build.ae src services sdk lower natives aether-ui/backend aether-ui/ui aether-ui/vg \
        -type f -newer "$f" 2>/dev/null | head -3)
    if [ -n "$newer" ]; then
        echo "run_all.sh: $f is older than its sources (e.g. $(echo $newer | tr '\n' ' '))" >&2
        echo "run_all.sh: rebuild with: ./build.sh && AETHER_UI_WITH_DRIVER=1 ./build.sh" >&2
        exit 2
    fi
done
# The window-less specs and the in-tree toolchain, as run_spec.sh chooses it.
. "$ROOT/tools/aether_home.sh"
sae_aether_home_ "$ROOT"
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    PATH="$SAE_AETHER_HOME/build:$PATH"; export PATH
    AETHER_HOME=$SAE_AETHER_HOME; export AETHER_HOME
fi

LOGS=target/run_all
rm -rf "$LOGS"; mkdir -p "$LOGS"
T=$ROOT/target
# Fresh app storage and shell logs every run: the specs that use them expect
# a first launch (pomatez's tasks were left from the run before, so its
# "2 to do" read 3 and failed on every run after the first).
rm -rf "$T/spec-storage" "$T/caps-appdata" "$T/globals-appdata" \
       "$T/spec-shell.log" "$T/caps-shell.log"
# label | environment (space-separated NAME=value) | command
TABLE="
spec_nav||spec spec_nav
spec_timers||spec spec_timers
spec_interrupted||spec spec_interrupted
spec_globals||spec spec_globals
spec_globals[app]|SAE_TEST_APP=tests/apps/globals SAE_APPDATA_DIR=$T/globals-appdata|spec spec_globals
spec_webrules||spec spec_webrules
spec_webrules[fine]|SAE_COARSE_CLOCKS=0|spec spec_webrules
spec_webrules[app]|SAE_TEST_APP=tests/apps/clocks|spec spec_webrules
spec_escape||spec spec_escape tests/escape
spec_storage_scope||spec spec_storage_scope
spec_imports||spec spec_imports
spec_raster||spec spec_raster
spec_reactive||spec spec_reactive
spec_terrain||spec spec_terrain
spec_life||spec spec_life
spec_algos||spec spec_algos
spec_keys||spec spec_keys
spec_grid||spec spec_grid
spec_reorder||spec spec_reorder
spec_menus_web||spec spec_menus_web
spec_ctxmenu||spec spec_ctxmenu
spec_tooltip||spec spec_tooltip
spec_a11y||spec spec_a11y
spec_aevg||spec spec_aevg
spec_aevg_parity||spec spec_aevg_parity
spec_camera||spec spec_camera
spec_local_nav|SAE_TEST_START=site/algos.ts|spec spec_local_nav
spec_app|SAE_TEST_APP=apps/tasks|spec spec_app
spec_app_caps|SAE_TEST_APP=tests/apps/caps SAE_APPDATA_DIR=$T/caps-appdata SAE_SHELL_LOG=$T/caps-shell.log|spec spec_app_caps
spec_app_climb|SAE_TEST_APP=tests/apps/climb|spec spec_app_climb
spec_app_documents|AETHER_UI_HEADLESS=1 SAE_TEST_APP=tests/apps/documents|spec spec_app_documents
spec_app_menus|SAE_TEST_APP=tests/apps/menus|spec spec_app_menus
spec_app_resize|SAE_TEST_APP=tests/apps/resize|spec spec_app_resize
spec_app_bus|SAE_TEST_FLAGS=--control-bus SAE_APPDATA_DIR=$T/bus-appdata SAE_TEST_APP=tests/apps/bus|spec spec_app_bus
spec_app_bus_ui|SAE_TEST_FLAGS=--control-bus SAE_APPDATA_DIR=$T/bus-ui-appdata SAE_TEST_APP=tests/apps/busui|spec spec_app_bus_ui
spec_app_bus_off|SAE_APPDATA_DIR=$T/bus-off-appdata SAE_TEST_APP=tests/apps/bus|spec spec_app_bus_off
spec_app_clipboard|AETHER_UI_HEADLESS=1 SAE_CLIP_READ=1 SAE_TEST_APP=tests/apps/clipboard|spec spec_app_clipboard
spec_app_clipboard_write|AETHER_UI_HEADLESS=1 SAE_CLIP_READ=0 SAE_TEST_APP=tests/apps/clipboard_write|spec spec_app_clipboard
spec_app_httplist|SAE_TEST_APP=tests/apps/httplist|spec spec_app_httplist
spec_app_imports|SAE_TEST_APP=tests/apps/imports|spec spec_app_imports
spec_app_net|SAE_TEST_APP=tests/apps/net|spec spec_app_net
spec_app_nohttp|SAE_TEST_APP=tests/apps/nohttp|spec spec_app_nohttp
spec_app_scoped|SAE_TEST_APP=tests/apps/scoped|spec spec_app_scoped
spec_app_scoped_path|SAE_TEST_APP=tests/apps/scoped_path|spec spec_app_scoped_path
spec_app_seeks|SAE_TEST_APP=tests/apps/seeks|spec spec_app_seeks
spec_app_sqlite|SAE_TEST_APP=tests/apps/sqlite_demo|spec spec_app_sqlite
spec_app_natives|SAE_TEST_APP=tests/apps/natives SAE_TEST_BIN=$T/hosts/natives_demo/target/build/bin/sae-driver|host tests/apps/natives spec_app_natives
spec_app_natives[absent]|SAE_TEST_APP=tests/apps/natives SAE_NATIVES_ABSENT=1|spec spec_app_natives
spec_gitify|SAE_TEST_APP=tests/apps/gitify SAE_STORAGE_DIR=$T/spec-storage SAE_SHELL_LOG=$T/spec-shell.log|spec spec_gitify
spec_pomatez|SAE_TEST_APP=examples/pomatez SAE_TIME_SCALE=60 SAE_STORAGE_DIR=$T/spec-storage|spec spec_pomatez
spec_http_grants||aerun spec_http_grants
spec_origin_rules||aerun spec_origin_rules
spec_sqlite_service||aerun spec_sqlite_service
check_page_veto||check check_page_veto
check_layers||check check_layers
check_android_sources||check check_android_sources
check_storage_scope||check check_storage_scope
spec_app_backend|SAE_TEST_APP=tests/apps/backend|backend tests/apps/backend spec_app_backend
spec_app_backend_stray|SAE_TEST_APP=tests/apps/backend_stray|backend tests/apps/backend_stray spec_app_backend_stray
spec_app_backend_deaf|SAE_TEST_APP=tests/apps/backend_deaf|backend tests/apps/backend_deaf spec_app_backend_deaf
spec_app_backend_wslc|SAE_TEST_APP=tests/apps/backend_wslc|wslc spec_app_backend_wslc
spec_app_channel|SAE_TEST_PARENT=1 SAE_TEST_APP=tests/apps/bus|spec spec_app_channel
check_sqlite_relaunch||check check_sqlite_relaunch
check_natives||check check_natives
check_module_rules||check check_module_rules
check_prelude||check check_prelude
lower||lower
"

pass=0; fail=0; failed=""
old_ifs=$IFS
IFS='
'
for line in $TABLE; do
    IFS=$old_ifs
    label=${line%%|*}; rest=${line#*|}
    envs=${rest%%|*}; cmd=${rest#*|}
    case "$label" in *"$FILTER"*) ;; *) IFS='
'; continue ;; esac
    log="$LOGS/$label.log"
    set -- $cmd
    kind=$1; shift
    case "$kind" in
        spec)  set -- tests/run_spec.sh "$@" ;;
        # an app's own host built first (tools/saehost.sh, docs/natives.md), then its spec
        host)  set -- sh -c 'AETHER_UI_WITH_DRIVER=1 tools/saehost.sh "$1" && tests/run_spec.sh "$2"' host "$@" ;;
        # an app's backend program built first (sdk/saebackend, docs/app-backend.md), then its spec
        backend) set -- sh -c '(cd "$1" && AETHER_LIB_DIR="$2/sdk" ae build backend/main.ae -o backend/main) && tests/run_spec.sh "$3"' backend "$1" "$ROOT" "$2" ;;
        # a backend in a WSL container: its image built first on Windows; elsewhere the spec checks the refusal
        wslc) case "$(uname -s)" in
                  MINGW*|MSYS*|CYGWIN*) set -- sh -c 'sh tests/apps/backend_wslc/build-image.sh && tests/run_spec.sh "$1"' wslc "$1" ;;
                  *) set -- tests/run_spec.sh "$1" ;;
              esac ;;
        aerun) set -- ae run "tests/$1.ae" ;;
        check) set -- sh "tests/$1.sh" ;;
        lower) set -- lower/run-tests.sh ;;
    esac
    # shellcheck disable=SC2086 -- envs is a list of NAME=value words
    if env $envs "$@" >"$log" 2>&1; then
        echo "PASS $label"; pass=$((pass + 1))
    else
        echo "FAIL $label (log: $log)"; fail=$((fail + 1)); failed="$failed $label"
    fi
    IFS='
'
done
IFS=$old_ifs
echo "$pass passed, $fail failed${failed:+:$failed}"
[ "$fail" -eq 0 ]
