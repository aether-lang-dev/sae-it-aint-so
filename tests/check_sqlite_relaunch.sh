#!/bin/sh
# tests/check_sqlite_relaunch.sh — app.json capabilities.sqlite across
# launches, against one fresh SAE_STORAGE_DIR: the first launch applies the
# migrations and writes rows; the second finds the rows and applies nothing
# again (spec_app_sqlite, phases 1 and 2); and an app whose migration fails
# is refused at start with the reason, before any page runs.
# Exit status: the number of failed phases.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
STORE="$ROOT/target/sqlite-relaunch-storage"
rm -rf "$STORE"
export SAE_STORAGE_DIR="$STORE"
fails=0
run() {   # run PHASE
    SAE_SQLITE_PHASE=$1 SAE_TEST_APP="$ROOT/tests/apps/sqlite_demo" "$ROOT/tests/run_spec.sh" spec_app_sqlite >"$ROOT/target/sqlite-relaunch-$1.out" 2>&1
    st=$?
    if [ $st -eq 0 ]; then echo "ok   launch $1"; else echo "FAIL launch $1 (target/sqlite-relaunch-$1.out)"; fails=$((fails + 1)); fi
}
run 1
run 2
# A failing migration refuses the app: exit status 1, the reason on the
# console, nothing of the page shown (SAE_NO_WINDOW runs the start without a window).
out=$(SAE_NO_WINDOW=1 "$ROOT/target/build/bin/sae-driver" --app "$ROOT/tests/apps/sqlite_badmig" 2>&1)
st=$?
if [ $st -eq 1 ] && printf '%s' "$out" | grep -q 'sae: sqlite notes: migration db/001_bad.sql failed: no such table: nowhere'; then
    echo "ok   a failing migration refuses the app with the reason"
else
    echo "FAIL a failing migration should refuse the app (exit $st): $out"
    fails=$((fails + 1))
fi
db=$(ls "$STORE"/app-sqlite_badmig-*/.sqlite/notes.db 2>/dev/null | head -1)
if [ -n "$db" ] && command -v sqlite3 >/dev/null 2>&1; then
    kept=$(sqlite3 "$db" "select count(*) from sqlite_master where name = 'notes'; select count(*) from _sae_migrations" | tr '\n' ' ')
    if [ "$kept" = "0 0 " ]; then
        echo "ok   nothing of the failed migration was kept (no notes table, nothing recorded)"
    else
        echo "FAIL the failed migration left something behind: $kept"
        fails=$((fails + 1))
    fi
fi
exit $fails
