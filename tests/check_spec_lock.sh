#!/bin/sh
# tests/check_spec_lock.sh -- tests/lib/spec_lock.sh, the lock tests/run_spec.sh
# holds for a spec's whole run (the page server and the driver bind fixed
# ports, so one spec at a time per machine):
#   a lock whose owner is alive is not taken by a second run, however old it
#     is (spraedsheet's spec_sheet runs for half an hour: an age limit let a
#     waiting run take the lock from under it and run beside it);
#   a lock whose owner has died is taken;
#   an owner whose lock is gone at its exit still exits with its own status
#     (under set -e, a failing rmdir in the EXIT trap turned "146 passing"
#     into exit 1), and does not remove a lock that is another run's now.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D=$(mktemp -d "${TMPDIR:-/tmp}/sae-spec-lock.XXXXXX") || exit 2
trap 'kill "$OWNER" 2>/dev/null; rm -rf "$D"' EXIT
. "$ROOT/tests/lib/spec_lock.sh"
L="$D/lock"
fail=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# run_spec.sh asks until it has the lock: a second ask, in case the first one
# cleared a lock it judged stale.
take() { spec_lock_try "$1" || spec_lock_try "$1"; }

# an owner that holds the lock until killed
sh -c '. "$1"; spec_lock_try "$2" && echo held; sleep 60' x "$ROOT/tests/lib/spec_lock.sh" "$L" >"$D/held" &
OWNER=$!
n=0; while [ ! -s "$D/held" ] && [ $n -lt 50 ]; do sleep 0.1; n=$((n + 1)); done
[ -s "$D/held" ] || { echo "FAIL the owner never took the lock"; exit 1; }

# old: backdate the lock an hour
touch -t "$(date -d '1 hour ago' +%Y%m%d%H%M 2>/dev/null || date -v-1H +%Y%m%d%H%M)" "$L" 2>/dev/null
if take "$L"; then bad "a second run took a lock whose owner is alive (an hour old)"; spec_lock_release "$L"; else ok "a lock whose owner is alive is kept, an hour old"; fi

kill "$OWNER" 2>/dev/null; wait "$OWNER" 2>/dev/null
if take "$L"; then ok "a lock whose owner has died is taken"; spec_lock_release "$L"; else bad "a lock whose owner died was not taken"; fi

# the owner's status when its lock was taken away
sh -c 'set -e; . "$1"; spec_lock_try "$2"; trap "spec_lock_release \"$2\"" EXIT INT TERM; rm -rf "$2"; exit 0' x "$ROOT/tests/lib/spec_lock.sh" "$L"
st=$?
[ $st -eq 0 ] && ok "an owner whose lock is gone exits 0 when it meant to" || bad "an owner whose lock is gone exited $st, not 0"

# ... and leaves a lock that is another run's now
sh -c '. "$1"; spec_lock_try "$2"; trap "spec_lock_release \"$2\"" EXIT; rm -rf "$2"; mkdir "$2"; echo other > "$2/pid"; exit 0' x "$ROOT/tests/lib/spec_lock.sh" "$L"
if [ -d "$L" ]; then ok "an owner's exit leaves another run's lock"; else bad "an owner's exit removed another run's lock"; fi
rm -rf "$L"
[ $fail -eq 0 ]
