# The lock tests/run_spec.sh holds for a spec's whole run: a directory whose
# pid file names the run that made it (tests/check_spec_lock.sh).
#
#   spec_lock_try DIR      0 when this shell now holds DIR; 1 when another live
#                          run does. A lock whose owner is gone is cleared
#                          (and 1 returned: try again).
#   spec_lock_release DIR  removes DIR if this shell made it; always 0, so an
#                          EXIT trap running it under set -e cannot change the
#                          status the script exits with.
#
# Whether the owner is alive decides, never how old the lock is: a spec can
# run for half an hour (spraedsheet's spec_sheet), and a waiting run that took
# a lock after ten minutes ran beside the owner on the same ports, and the
# owner's own rmdir then failed in its EXIT trap, so a suite with every case
# passing exited 1.

_spec_lock_alive() {   # a pid: kill -0, which a pid of another user fails; ps then
    kill -0 "$1" 2>/dev/null || ps -p "$1" >/dev/null 2>&1
}

spec_lock_try() {
    if mkdir "$1" 2>/dev/null; then
        echo $$ >"$1/pid"
        return 0
    fi
    _pid=$(cat "$1/pid" 2>/dev/null)
    if [ -n "$_pid" ]; then
        _spec_lock_alive "$_pid" && return 1
    else
        # no pid yet: the owner is between mkdir and writing it, or died there.
        [ -n "$(find "$1" -maxdepth 0 -mmin +1 2>/dev/null)" ] || return 1
    fi
    # Its owner is gone. Take the directory aside first (a rename one run
    # wins), then check it is the lock judged dead: the winner may have made
    # a new one between our reading and our rename, which is put back.
    _aside="$1.stale.$$"
    mv "$1" "$_aside" 2>/dev/null || return 1
    if [ "$(cat "$_aside/pid" 2>/dev/null)" = "$_pid" ]; then
        rm -rf "$_aside"
    else
        mv "$_aside" "$1" 2>/dev/null || rm -rf "$_aside"
    fi
    return 1
}

spec_lock_release() {
    if [ "$(cat "$1/pid" 2>/dev/null)" = "$$" ]; then rm -rf "$1" 2>/dev/null; fi
    return 0
}
