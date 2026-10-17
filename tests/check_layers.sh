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
    "import std.fs|import std.dir|import std.string|import std.strarr|import std.sandbox"
expect_imports services/documents/module.ae \
    "import std.fs|import std.string|import std.strarr|import std.sandbox|import std.encoding"
expect_imports services/clipboard/module.ae \
    "import ui (clipboard_read, clipboard_write)|import std.string"
expect_imports services/bus/module.ae \
    "import std.tcp|import std.fs|import std.list|import std.string|import std.strarr|import std.json|import std.time (now_ms)|import services.agent_auth|import services.secure_channel"
expect_imports services/agent_auth/module.ae \
    "import std.nanoid|import std.cryptography (hmac_sha256_hex)|import std.string (bytes, string_length, string_char_at)"
expect_imports services/secure_channel/module.ae \
    "import std.bytes|import std.string (string_length, string_char_at, string_index_of, string_substring, string_equals, string_from_char, string_from_long, to_long)|import std.cryptography.ascon_aead128 (aead_seal, aead_open)|import std.cryptography.hkdf (hkdf)|import std.cryptography (random_bytes)|import std.time (now_ms)"
expect_imports services/shell/module.ae \
    "import ui (open_url)|import std.fs (read, write_atomic)|import std.string|import std.strarr"
expect_imports services/print/module.ae \
    "import ui (print_pdf)|import std.fs (write_atomic, mkdir_p)|import std.string|import std.encoding"
expect_imports services/net/module.ae \
    "import std.http.client (request)|import std.string|import std.strarr"
expect_imports services/sqlite/module.ae \
    "import contrib.sqlite as engine|import std.json|import std.string|import std.strarr"

# contrib.sqlite (the engine) only in services/sqlite: every statement an app
# runs goes through the one module that opens a connection with the escape
# routes off (the authorizer, no attached databases, no extension loading).
hits=$(grep -rnE '^import contrib\.sqlite' --include='*.ae' src services lower tools gen 2>/dev/null \
      | grep -v '^services/sqlite/' || true)
if [ -n "$hits" ]; then
    echo "FAIL contrib.sqlite imported outside services/sqlite:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   contrib.sqlite is imported only in services/sqlite"
fi
expect_imports services/stdlib/module.ae \
    "import std.fs (read, exists)|import std.string|import std.strarr|import std.cryptography (sha256_hex)"

# Listening for connections only in services/bus: the control bus is the
# one place sae accepts them, under its rules (docs/control-bus.md).
hits=$(grep -rnE '(tcp\.(listen|listen_on|accept)|tcp_listen(_on)?_raw|tcp_accept_raw|server_create)[[:space:]]*\(' \
        --include='*.ae' src services lower 2>/dev/null \
      | grep -v '^services/bus/' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
    echo "FAIL a listener outside services/bus:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   sae listens only in services/bus"
fi

# ui.clipboard_read and clipboard_write only in services/clipboard: every
# read and write of the system clipboard goes through its rules.
hits=$(grep -rnE '(^|[^_a-zA-Z0-9])clipboard_(read|write)[[:space:]]*\(' \
        --include='*.ae' src services lower tools gen 2>/dev/null \
      | grep -v '^services/clipboard/' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
    echo "FAIL the system clipboard named outside services/clipboard:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   the system clipboard is named only in services/clipboard"
fi

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

# ui.print_pdf, or a bare print_pdf from a selective import, only in
# services/print: every print request is checked against capabilities.print.
hits=$(grep -rnE '(^|[^_a-zA-Z0-9])print_pdf[[:space:]]*\(|import ui \([^)]*print_pdf' \
        --include='*.ae' src services lower tools gen 2>/dev/null \
      | grep -v '^services/print/' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
    echo "FAIL print_pdf named outside services/print:"
    echo "$hits" | sed 's/^/       /'
    fail=1
else
    echo "ok   print_pdf is named only in services/print"
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
