#!/bin/sh
# tests/check_page_veto.sh — the page veto is in place and enforced.
#
# 1. Every function a page can reach (each SAE_JSFN in src/sae_rom.c) opens
#    with the page veto: one `hide` line, the same in all of them (see "The
#    page veto" in src/sae_host.ae).
# 2. The compiler in use enforces that line where it matters: a hidden
#    module named inside an `if` body, a nested block or a closure fails to
#    compile. Aether before the fix for nested qualified names let all three
#    through, which made `hide fs` decorative.
#
# Exit status: the number of failed checks.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOST="$ROOT/src/sae_host.ae"
fails=0

# Same toolchain choice as build.sh: an Aether dev tree beside sae wins.
if [ -z "${SAE_AETHER_HOME:-}" ] && [ -f "$ROOT/../aether/build/libaether.a" ]; then
    SAE_AETHER_HOME=$(cd "$ROOT/../aether" && pwd)
fi
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"

ok()   { echo "ok   $1"; }
bad()  { echo "FAIL $1"; fails=$((fails + 1)); }

# --- 1. every page-API function carries the veto ---

veto=$(grep -m1 '^    hide fs, os, client' "$HOST")
if [ -z "$veto" ]; then
    bad "src/sae_host.ae has no page veto line"
    exit 1
fi
n=0
for fn in $(grep -o 'SAE_JSFN([a-z_0-9]*' "$ROOT/src/sae_rom.c" | sed 's/SAE_JSFN(//' | grep -vx name); do
    n=$((n + 1))
    first=$(awk -v fn="$fn" '
        prev == "@c_callback" && index($0, fn "(ctx: ptr") == 1 { getline; print; exit }
        { prev = $0 }' "$HOST")
    if [ "$first" != "$veto" ]; then
        bad "$fn: does not open with the page veto (has: ${first:-nothing})"
    fi
done
[ "$n" -gt 0 ] || bad "no SAE_JSFN prototypes found in src/sae_rom.c"
[ "$fails" -eq 0 ] && ok "all $n page-API functions open with the page veto"

# --- 2. the compiler enforces it, at depth ---

work="$ROOT/target/veto-check"
rm -rf "$work" && mkdir -p "$work"
# The modules the veto names that a standalone program can import; the
# kernel functions are stubbed so the line resolves as it does in the host.
cat > "$work/head.ae" <<EOF
import std.fs
import std.os
import std.http.client
EOF
for f in env_ fetch_ load_ go_ run_nav_ page_new_ page_free_ page_run_ browser_new_ \
         build_chrome_ set_status_ sae_main sae_new_context JS_Parse JS_Run JS_FreeContext; do
    echo "$f() -> int { return 0 }" >> "$work/head.ae"
done
lower_stub='lower() -> int { return 0 }'

probe() {   # probe <name> <expect: accept|reject> <body lines>
    name=$1; expect=$2; body=$3
    {
        cat "$work/head.ae"
        echo "$lower_stub"
        echo "page_fn(n: int) -> int {"
        echo "$veto"
        printf '%s\n' "$body"
        echo "    return n"
        echo "}"
        echo "main() { println(page_fn(1)) }"
    } > "$work/$name.ae"
    if (cd "$work" && ae build "$name.ae" -o "$work/$name" >"$work/$name.log" 2>&1); then got=accept; else got=reject; fi
    if [ "$got" = "$expect" ]; then
        ok "compiler: $name is ${expect}ed"
    else
        bad "compiler: $name should be ${expect}ed (log: target/veto-check/$name.log)"
    fi
}

probe clean accept '    x = n + 1'
probe fs_direct reject '    _c, _e = fs.read("/etc/hosts")'
probe fs_in_if reject '    if n > 0 {
        _c, _e = fs.read("/etc/hosts")
    }'
probe os_in_block reject '    {
        _v = os.getenv("HOME")
    }'
probe client_in_closure reject '    g = || { _r = client.request("GET", "http://example.com") }
    g()'
probe kernel_fn reject '    if n > 0 { _x = fetch_() }'

exit $fails
