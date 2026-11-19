#!/bin/sh
# listeners.sh PID...: what each process listens on, one name a line: its
# listening TCP sockets ("127.0.0.1:8080", "[v6]:8080" for IPv6) and its
# Unix sockets that have a name in the file system (one a client could
# connect to; the unnamed pairs are not). The test's UI driver port
# (AETHER_UI_TEST_PORT, 9222 unless it is set) is left out. Prints "(no lsof)" where there is neither /proc (Linux) nor
# lsof (macOS and the BSDs).
#
# On Linux it reads /proc, so the tests need no lsof there: a process's
# sockets are its /proc/PID/fd entries "socket:[inode]", found in
# /proc/PID/net/tcp, tcp6 (state 0A is LISTEN) and /proc/net/unix.
DRIVER_PORT=${AETHER_UI_TEST_PORT:-9222}
for p in "$@"; do
    if [ -d "/proc/$p/fd" ]; then
        inodes=$(for f in /proc/$p/fd/*; do
            l=$(readlink "$f" 2>/dev/null)
            if [ "${l#socket:}" != "$l" ]; then echo "$l" | sed 's/^socket:\[\(.*\)\]$/\1/'; fi
        done | tr '\n' ' ')
        [ -n "${inodes# }" ] || continue
        for t in tcp tcp6; do
            [ -r "/proc/$p/net/$t" ] || continue
            awk -v want="$inodes" -v fam="$t" -v skip="$DRIVER_PORT" '
                function hex(s,   i, n, c) {
                    n = 0
                    for (i = 1; i <= length(s); i++) {
                        c = index("0123456789ABCDEF", substr(toupper(s), i, 1)) - 1
                        n = n * 16 + c
                    }
                    return n
                }
                BEGIN { n = split(want, w, " "); for (i = 1; i <= n; i++) mine[w[i]] = 1 }
                NR > 1 && $4 == "0A" && ($10 in mine) {
                    split($2, a, ":")
                    port = hex(a[2])
                    if (port == skip) next
                    if (fam == "tcp") {
                        ip = hex(substr(a[1], 7, 2)) "." hex(substr(a[1], 5, 2)) "." hex(substr(a[1], 3, 2)) "." hex(substr(a[1], 1, 2))
                        print ip ":" port
                    } else {
                        print "[" a[1] "]:" port
                    }
                }' "/proc/$p/net/$t"
        done
        awk -v want="$inodes" '
            BEGIN { n = split(want, w, " "); for (i = 1; i <= n; i++) mine[w[i]] = 1 }
            NR > 1 && ($7 in mine) && substr($8, 1, 1) == "/" { print $8 }' /proc/net/unix
    elif command -v lsof >/dev/null 2>&1; then
        lsof -nP -a -p "$p" -iTCP -sTCP:LISTEN -Fn 2>/dev/null | grep '^n' | grep -vE ":$DRIVER_PORT(->[*]:[*])?\$" | sed 's/^n//'
        lsof -nP -a -p "$p" -U -Fn 2>/dev/null | grep '^n/' | sed 's/^n//'
    else
        echo '(no lsof)'
        exit 0
    fi
done
exit 0
