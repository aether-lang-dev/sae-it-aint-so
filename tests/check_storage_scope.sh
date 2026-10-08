#!/bin/sh
# tests/check_storage_scope.sh — storage scoping, across launches: two apps
# with the same app.json name, the first one reopened, and file: pages in
# two directories, all against one fresh SAE_STORAGE_DIR.
# Exit status: the number of failed phases.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
STORE="$ROOT/target/scope-storage"
rm -rf "$STORE"
export SAE_STORAGE_DIR="$STORE"
fails=0
run() {   # run PHASE [APP]
    if [ -n "${2:-}" ]; then
        SAE_SCOPE_PHASE=$1 SAE_TEST_APP="$2" "$ROOT/tests/run_spec.sh" spec_storage_scope >"$ROOT/target/scope-$1.out" 2>&1
    else
        SAE_SCOPE_PHASE=$1 "$ROOT/tests/run_spec.sh" spec_storage_scope >"$ROOT/target/scope-$1.out" 2>&1
    fi
    st=$?
    if [ $st -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1 (target/scope-$1.out)"; fails=$((fails + 1)); fi
}
run app_a "$ROOT/tests/apps/samename_a"
run app_b "$ROOT/tests/apps/samename_b"
run app_a2 "$ROOT/tests/apps/samename_a"
SAE_TEST_START="$ROOT/tests/storage_pages/one/store.ts" run files
echo "storage folders: $(ls "$STORE" | tr '\n' ' ')"
exit $fails
