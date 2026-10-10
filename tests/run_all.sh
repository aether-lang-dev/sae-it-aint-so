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
# target/saelower and target/saejs (AGENTS.md "Build and test"). On Linux with no display it reruns itself
# under xvfb-run.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1
FILTER=${1:-}
if [ "$(uname -s)" = Linux ] && [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] \
   && [ -z "${SAE_RUN_ALL_XVFB:-}" ] && command -v xvfb-run >/dev/null 2>&1; then
    SAE_RUN_ALL_XVFB=1 exec xvfb-run -a sh "$0" "$@"
fi
for f in target/build/bin/sae target/build/bin/sae-driver target/pageserver target/saelower target/saejs; do
    [ -x "$f" ] || { echo "run_all.sh: no $f (AGENTS.md \"Build and test\")" >&2; exit 2; }
done
# The window-less specs and the in-tree toolchain, as run_spec.sh chooses it.
if [ -f "$ROOT/../aether/build/libaether.a" ] && [ "${SAE_AETHER_HOME:-}" != none ]; then
    AE_HOME=${SAE_AETHER_HOME:-$(cd "$ROOT/../aether" && pwd)}
    PATH="$AE_HOME/build:$PATH"; export PATH
    AETHER_HOME=$AE_HOME; export AETHER_HOME
fi

LOGS=target/run_all
rm -rf "$LOGS"; mkdir -p "$LOGS"
T=$ROOT/target
# label | environment (space-separated NAME=value) | command
TABLE="
spec_nav||spec spec_nav
spec_timers||spec spec_timers
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
spec_aevg||spec spec_aevg
spec_aevg_parity||spec spec_aevg_parity
spec_camera||spec spec_camera
spec_local_nav|SAE_TEST_START=site/algos.ts|spec spec_local_nav
spec_app|SAE_TEST_APP=apps/tasks|spec spec_app
spec_app_caps|SAE_TEST_APP=tests/apps/caps SAE_APPDATA_DIR=$T/caps-appdata SAE_SHELL_LOG=$T/caps-shell.log|spec spec_app_caps
spec_app_climb|SAE_TEST_APP=tests/apps/climb|spec spec_app_climb
spec_app_httplist|SAE_TEST_APP=tests/apps/httplist|spec spec_app_httplist
spec_app_imports|SAE_TEST_APP=tests/apps/imports|spec spec_app_imports
spec_app_net|SAE_TEST_APP=tests/apps/net|spec spec_app_net
spec_app_nohttp|SAE_TEST_APP=tests/apps/nohttp|spec spec_app_nohttp
spec_app_scoped|SAE_TEST_APP=tests/apps/scoped|spec spec_app_scoped
spec_app_scoped_path|SAE_TEST_APP=tests/apps/scoped_path|spec spec_app_scoped_path
spec_app_seeks|SAE_TEST_APP=tests/apps/seeks|spec spec_app_seeks
spec_app_sqlite|SAE_TEST_APP=tests/apps/sqlite_demo|spec spec_app_sqlite
spec_gitify|SAE_TEST_APP=tests/apps/gitify SAE_STORAGE_DIR=$T/spec-storage SAE_SHELL_LOG=$T/spec-shell.log|spec spec_gitify
spec_pomatez|SAE_TEST_APP=examples/pomatez SAE_TIME_SCALE=60 SAE_STORAGE_DIR=$T/spec-storage|spec spec_pomatez
spec_http_grants||aerun spec_http_grants
spec_origin_rules||aerun spec_origin_rules
spec_sqlite_service||aerun spec_sqlite_service
check_page_veto||check check_page_veto
check_layers||check check_layers
check_android_sources||check check_android_sources
check_storage_scope||check check_storage_scope
check_sqlite_relaunch||check check_sqlite_relaunch
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
