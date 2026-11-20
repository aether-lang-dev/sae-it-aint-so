#!/bin/sh
# tests/check_page_veto.sh — the page-API functions' seals and the page veto
# are in place and enforced.
#
# 1. Every function a page can reach (each one the gate spec binds with api,
#    global_fn, patch, loader_fn or held_fn, and any api_register_ or
#    ae_register_ still installs with reg_, glob_fn_ or host_fn_) opens with
#    its own `seal except <names>` line (step 10 of docs/design/gate-dsl.md;
#    tests/check_gate.sh holds the names to the spec's basis and reach), but
#    for SEAL_HELD's (tests/check_gate.sh), which open with the page veto
#    until Aether fixes the faults that keep them there; every function with
#    the page-API signature is one of them (none left unbound, as dead code
#    the check could not see); and every veto line in the host (the helpers
#    the seals name carry it) is the one written here.
# 2. The compiler in use enforces both where it matters: a hidden module, or
#    one a seal does not list, named inside an `if` body, a nested block or a
#    closure fails to compile; a seal admits what it lists, the function's
#    own parameters and locals, and a closure's view of them. Aether before
#    the fix for nested qualified names let the veto's three through, which
#    made `hide fs` decorative.
#
# Exit status: the number of failed checks.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOST="$ROOT/src/sae_host.ae"
fails=0

# Same toolchain choice as build.sh: an Aether dev tree beside sae wins,
# unless SAE_AETHER_HOME=none.
. "$ROOT/tools/aether_home.sh"
sae_aether_home_ "$ROOT"
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"

ok()   { echo "ok   $1"; }
bad()  { echo "FAIL $1"; fails=$((fails + 1)); }

# --- 1. every page-API function carries the veto ---

# The page veto, as every function that carries it writes it (since step 10
# the page-API functions open with their own seal, and the veto is the line
# of the helpers they reach: tests/check_gate.sh).
veto='    hide fs, os, client, net, lower, pagegrants, env_, fetch_, load_, go_, run_nav_, page_new_, page_free_, page_run_, browser_new_, build_chrome_, set_status_, sae_main, engine_new_, engine_eval_, engine_dispose_'
others=$(grep '^    hide fs, os, client' "$HOST" | grep -vxF -- "$veto" | head -3)
[ -z "$others" ] || bad "a veto line in src/sae_host.ae differs from the one this check holds: $others"
n=0
nseal=0
held=$(sed -n 's/^SEAL_HELD="\(.*\)"$/\1/p' "$ROOT/tests/check_gate.sh")
# The functions api_register_ hands the engine: the last argument of each
# reg_(...), glob_fn_(...) and host_fn_(...) call inside it; and the functions
# the gate spec (gate_spec_, the DSL of src/sae_host.ae) binds: the function
# of each api(name, fn, arity), global_fn(g, name, fn, arity),
# patch(g, global, name, fn, arity), loader_fn(g, name, fn, arity) and
# held_fn(g, name, fn, arity) line (one per line, as the spec is written).
fns=$(awk '/^(api_register_|ae_register_)\(/ { on = 1; next } on && /^}/ { on = 0 }
           on && /(reg_|glob_fn_|host_fn_)\(/ { line = $0; sub(/\)[[:space:]]*$/, "", line); n = split(line, a, ","); f = a[n]; gsub(/[[:space:]]/, "", f); print f }' "$HOST"
      awk '/^gate_spec_\(/ { on = 1; next } on && /^}/ { exit }
           on && /^[[:space:]]*(api|global_fn|patch|loader_fn|held_fn)\(/ {
               line = $0; sub(/^[[:space:]]*/, "", line); kind = line; sub(/\(.*/, "", kind)
               sub(/^[a-z_]+\(/, "", line); sub(/\).*$/, "", line); n = split(line, a, ",")
               i = (kind == "api") ? 2 : (kind == "patch") ? 4 : 3
               f = a[i]; gsub(/[[:space:]]/, "", f); print f }' "$HOST")
fns=$(printf '%s\n' "$fns" | sort -u)
for fn in $fns; do
    n=$((n + 1))
    # Each takes its page first (host_fn_ hands it over): fn(p: *Page, ...).
    first=$(awk -v fn="$fn" 'index($0, fn "(p: *Page,") == 1 { getline; print; exit }' "$HOST")
    case "$first" in
        "    seal except "*) nseal=$((nseal + 1)) ;;
        *)
            case " $held " in
                *" $fn "*) [ "$first" = "$veto" ] || bad "$fn: held on the veto (SEAL_HELD), but does not open with it (has: ${first:-nothing})" ;;
                *) bad "$fn: does not open with a seal (has: ${first:-nothing})" ;;
            esac ;;
    esac
done
[ "$n" -gt 0 ] || bad "no page-API functions found in api_register_"
[ "$fails" -eq 0 ] && ok "all $n page-API functions open with a seal ($nseal) or, held by an Aether fault (SEAL_HELD), the page veto ($((n - nseal)))"
# Every function with the page-API signature is bound by one of them.
tmp_b=$(mktemp); tmp_d=$(mktemp)
printf '%s\n' "$fns" | sort > "$tmp_b"
grep -E '^[a-z_0-9]+\(p: \*Page, this_val: int, argv: int\)' "$HOST" | sed 's/(.*//' | sort > "$tmp_d"
unbound=$(comm -23 "$tmp_d" "$tmp_b")
rm -f "$tmp_b" "$tmp_d"
if [ -n "$unbound" ]; then
    bad "page-API functions that nothing binds (delete them, or bind them in the gate spec): $(echo $unbound)"
else
    ok "every function with the page-API signature is bound"
fi

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
         build_chrome_ set_status_ sae_main engine_new_ engine_eval_ engine_dispose_; do
    echo "$f() -> int { return 0 }" >> "$work/head.ae"
done
lower_stub='lower() -> int { return 0 }
net() -> int { return 0 }'

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
probe net_service reject '    if n > 0 { _x = net() }'
# A module imported under an alias is hidden by its real name too: the veto
# names `fs`, and a helper that imported std.fs as files would write
# files.read (so on 0.926.0 and 0.931.0; aether #3781 made `hide files` hide
# it as well, which on 0.926.0 hid nothing).
sed 's/^import std.fs$/import std.fs as files/' "$work/head.ae" > "$work/head_alias.ae"
cp "$work/head.ae" "$work/head_plain.ae"
cp "$work/head_alias.ae" "$work/head.ae"
probe fs_by_alias reject '    if n > 0 { _c, _e = files.read("/etc/hosts") }'
cp "$work/head_plain.ae" "$work/head.ae"

# A page-API function's own seal: what it lists and its own names pass, and
# anything else is refused at any depth (the shape of the bound functions:
# `seal except quickjs, own_` and the like).
sealprobe() {   # sealprobe <name> <expect> <seal list> <body lines>
    name=$1; expect=$2; list=$3; body=$4
    {
        cat "$work/head.ae"
        echo "$lower_stub"
        echo 'helper_(x: int) -> int { return x + 1 }
mm_(f: fn) { f() }'
        echo "page_fn(n: int) -> int {"
        echo "    seal except $list"
        printf '%s\n' "$body"
        echo "    return n"
        echo "}"
        echo "main() { println(page_fn(1)) }"
    } > "$work/$name.ae"
    if (cd "$work" && ae build "$name.ae" -o "$work/$name" >"$work/$name.log" 2>&1); then got=accept; else got=reject; fi
    if [ "$got" = "$expect" ]; then
        ok "compiler: seal $name is ${expect}ed"
    else
        bad "compiler: seal $name should be ${expect}ed (log: target/veto-check/$name.log)"
    fi
}
sealprobe listed accept 'helper_' '    x = helper_(n)
    q = x + n'
sealprobe closure_locals accept 'helper_, mm_' '    x = n + 1
    mm_(|| { _y = helper_(x + n) })'
sealprobe unlisted_helper reject 'mm_' '    if n > 0 { _x = helper_(n) }'
sealprobe fs_unlisted reject 'helper_' '    {
        _c, _e = fs.read("/etc/hosts")
    }'
sealprobe client_in_closure reject 'helper_, mm_' '    mm_(|| { _r = client.request("GET", "http://example.com") })'
sealprobe kernel_fn reject 'helper_' '    if n > 0 { _x = fetch_() }'
sealprobe os_listed_other reject 'fs' '    _v = os.getenv("HOME")'

exit $fails
