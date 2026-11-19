#!/bin/sh
# tests/check_listeners.sh -- tests/lib/listeners.sh (what spec_app_backend and
# spec_app_channel ask: "does this process listen on anything?") sees a
# listening TCP socket and a named Unix socket, and says nothing of a process
# that has neither. Linux reads /proc, macOS and the BSDs lsof. Other systems
# skip (the specs use PowerShell on Windows).
ROOT=$(cd "$(dirname "$0")/.." && pwd)
case "$(uname -s)" in Linux|Darwin|FreeBSD|NetBSD|OpenBSD) ;; *) echo "skip: not a Unix"; exit 0;; esac
command -v python3 >/dev/null 2>&1 || { echo "skip: no python3"; exit 0; }
D=$(mktemp -d "${TMPDIR:-/tmp}/sae-listeners.XXXXXX") || exit 2
trap 'kill "$LPID" "$QPID" 2>/dev/null; { wait "$LPID" "$QPID"; } 2>/dev/null; rm -rf "$D"' EXIT
python3 - "$D" >"$D/out" 2>&1 <<'PY' &
import socket, sys, time
d = sys.argv[1]
t = socket.socket(); t.bind(("127.0.0.1", 0)); t.listen(1)
u = socket.socket(socket.AF_UNIX); u.bind(d + "/s.sock"); u.listen(1)
print(t.getsockname()[1], flush=True)
time.sleep(60)
PY
LPID=$!
sleep 30 &
QPID=$!
n=0
while [ ! -s "$D/out" ] && [ "$n" -lt 50 ]; do sleep 0.1; n=$((n + 1)); done
port=$(cat "$D/out")
got=$(sh "$ROOT/tests/lib/listeners.sh" "$LPID")
fail=0
case "$got" in *"127.0.0.1:$port"*) echo "ok   the TCP listener is seen ($port)";; *) echo "FAIL no TCP listener on $port in: $got"; fail=1;; esac
case "$got" in *"$D/s.sock"*) echo "ok   the Unix socket is seen";; *) echo "FAIL no Unix socket $D/s.sock in: $got"; fail=1;; esac
none=$(sh "$ROOT/tests/lib/listeners.sh" "$QPID")
if [ -z "$none" ]; then echo "ok   a process with no sockets listens on nothing"; else echo "FAIL a process with none listens on: $none"; fail=1; fi
exit $fail
