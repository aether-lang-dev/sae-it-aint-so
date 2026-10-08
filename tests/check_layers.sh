#!/bin/sh
# tests/check_layers.sh — the layer rules of docs/architecture.md that the
# compiler cannot hold yet.
#
# A service's reach is its imports: services/files cannot open a URL because
# it does not import ui, services/shell cannot read a page's files because
# it imports only two fs calls. This script holds each service to its import
# list, so widening one is a reviewed change to this file, and checks that
# ui.open_url (the system URL opener) is named nowhere but services/shell,
# and client.request (an outgoing request) nowhere but services/net.
# The kernel imports all of ui to build the browser, and Aether can hide a
# namespace but not one member of it (asks/aether-hide-one-member.md), so
# that rule is a grep until it can be a `hide`.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
fail=0

# The imports each service may have, exactly.
expect_imports() {   # expect_imports FILE "line|line|..."
    got=$(grep -E '^import ' "$1" | sort | tr '\n' '|')
    want=$(printf '%s' "$2" | tr '|' '\n' | sort | tr '\n' '|')
    if [ "$got" = "$want" ]; then
        echo "ok   $1 imports only: $(printf '%s' "$2" | sed 's/|/, /g')"
    else
        echo "FAIL $1 imports changed:"
        echo "       expected: $want"
        echo "       found:    $got"
        fail=1
    fi
}

expect_imports services/files/module.ae \
    "import std.fs|import std.dir|import std.string|import std.strarr"
expect_imports services/shell/module.ae \
    "import ui (open_url)|import std.fs (read, write_atomic)|import std.string|import std.strarr"
expect_imports services/net/module.ae \
    "import std.http.client (request)|import std.string|import std.strarr"

# ui.open_url, or a bare open_url from a selective import, only in services/shell.
hits=$(grep -rnE '(^|[^_a-zA-Z0-9])open_url[[:space:]]*\(|import ui \([^)]*open_url' \
        --include='*.ae' src services lower tools gen 2>/dev/null \
      | grep -v '^services/shell/' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
    echo "FAIL open_url named outside services/shell:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   open_url is named only in services/shell"
fi

# client.request (building an outgoing request), or a bare request() from a
# selective import, only in services/net: every request sae makes is opened
# there, after app.json capabilities.http is checked. The kernel still sends, reads and
# frees requests (send_request, response_*, request_free), which need one.
hits=$(grep -rnE 'client\.request[[:space:]]*\(|import std\.http\.client \([^)]*request[,)]' \
        --include='*.ae' src services lower tools gen 2>/dev/null \
      | grep -v '^services/net/' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
    echo "FAIL client.request named outside services/net:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   client.request is named only in services/net"
fi

# The kernel does not list directories; services/files does, for pages.
if grep -qE '^import std\.dir' src/sae_host.ae; then
    echo "FAIL src/sae_host.ae imports std.dir (directory listing belongs to services/files)"
    fail=1
else
    echo "ok   the kernel does not import std.dir"
fi

exit $fail
