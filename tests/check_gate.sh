#!/bin/sh
# tests/check_gate.sh -- the gate spec (gate_spec_ in src/sae_host.ae), the
# checked-in sae.d.ts and the objects a page really sees agree
# (docs/design/gate-dsl.md, section 4, step 2).
#
# (i)   tools/gen-dts.sh regenerates sae.d.ts from `sae --gate-describe` and
#       it is the checked-in file, byte for byte (as check_prelude.sh holds
#       src/sae_prelude.c).
# (ii)  tests/gate/dump.ts, run headless in each mode of tests/gate/dump.sh (a
#       web page seeking nothing or something; an app granted and seeking
#       everything, something, nothing, or one privilege at a time, or granted
#       nothing and seeking everything as optional), prints each global's own keys, typeof and
#       .length; for every global and member the spec describes, that is what
#       the spec says that mode has (a namespace not yet in the spec is
#       compared with nothing).
# (iii) each entry's declared arity is its count of non-rest parameters.
# (iv)  no function-typed parameter, and no local bound to a closure, anywhere
#       the build or the checkout beside it reaches, is named like a function
#       of the gate DSL. Until the Aether compiler is fixed, a top-level
#       function X takes the place of a parameter X that a closure captures and
#       passes on as a value (aether-ui's `reorderable(cb: fn)` crashed when
#       the DSL had a `cb` setter; tests/check_gate_probes.sh has the shape).
#
# Needs target/build/bin/sae and target/saegate.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SAE="$ROOT/target/build/bin/sae"
GATE="$ROOT/target/saegate"
WORK="$ROOT/target/gate"
mkdir -p "$WORK"
fails=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }
for f in "$SAE" "$GATE"; do
    [ -x "$f" ] || { echo "FAIL no ${f#$ROOT/} (AGENTS.md \"Build and test\")"; exit 1; }
done
SAE_NO_WINDOW=1 "$SAE" --gate-describe > "$WORK/describe.jsonl" || { echo "FAIL sae --gate-describe failed"; exit 1; }

# --- (i) sae.d.ts is what the spec says ---
if sh "$ROOT/tools/gen-dts.sh" "$WORK/sae.d.ts" && cmp -s "$WORK/sae.d.ts" "$ROOT/sae.d.ts"; then
    ok "sae.d.ts is what tools/gen-dts.sh makes of the spec"
else
    bad "sae.d.ts is not what the spec says: run tools/gen-dts.sh (diff: diff sae.d.ts target/gate/sae.d.ts)"
fi

# --- (iii) arity ---
if out=$("$GATE" --check-arity < "$WORK/describe.jsonl" 2>&1); then
    ok "$(echo "$out" | sed 's/^ok *//')"
else
    bad "arity: $out"
fi

# --- (ii) the live objects ---
for mode in web webseeks all some unsought optional none \
    just-local-filesystem just-outgoing-http just-open-urls just-print just-documents just-clipboard just-clipboard-read just-control-bus; do
    "$GATE" --expect "$mode" < "$WORK/describe.jsonl" | LC_ALL=C sort > "$WORK/expect-$mode.txt"
    sh "$ROOT/tests/gate/dump.sh" "$mode" 2>&1 | grep '^[GM] ' > "$WORK/dump-$mode.txt"
    # the dump's lines about the names the spec describes
    awk 'NR == FNR { n = $2; sub(/\..*/, "", n); want[n] = 1; next }
         { n = $2; sub(/\..*/, "", n); if (n in want) print }' \
        "$WORK/expect-$mode.txt" "$WORK/dump-$mode.txt" | LC_ALL=C sort > "$WORK/seen-$mode.txt"
    if [ ! -s "$WORK/seen-$mode.txt" ]; then
        bad "$mode: the page dump has nothing (target/gate/dump-$mode.txt)"
    elif cmp -s "$WORK/expect-$mode.txt" "$WORK/seen-$mode.txt"; then
        ok "$mode: $(wc -l < "$WORK/seen-$mode.txt" | tr -d ' ') lines of the live page match the spec"
    else
        bad "$mode: the live page differs from the spec (< spec, > page):"
        diff "$WORK/expect-$mode.txt" "$WORK/seen-$mode.txt" | sed 's/^/       /'
    fi
done

# --- (iv) the DSL's names, against function-typed parameters ---
# The DSL's functions: the top-level functions of sae_host.ae between the
# "the gate" banner and gate_spec_.
dsl=$(awk '/^\/\/ ===== the gate:/ { on = 1; next } /^gate_spec_\(/ { exit }
           on && /^[a-z_0-9]+\(/ { n = $0; sub(/\(.*/, "", n); print n }' "$ROOT/src/sae_host.ae" | sort -u)
pat=$(printf '%s\n' $dsl | paste -sd'|' -)
roots="$ROOT/src $ROOT/services $ROOT/lower $ROOT/aevg $ROOT/sdk $ROOT/natives $ROOT/tools"
for d in "$ROOT/aether-ui/" "$ROOT/../aether-ui/"; do [ -d "$d" ] && roots="$roots $d" && break; done
[ -n "${AETHER_HOME:-}" ] && [ -d "$AETHER_HOME/share/aether/std" ] && roots="$roots $AETHER_HOME/share/aether/std $AETHER_HOME/share/aether/contrib"
clash=$(grep -rnE --include='*.ae' "\b($pat)\b[[:space:]]*:[[:space:]]*(@keep[[:space:]]+)?fn\b|^[[:space:]]*($pat)[[:space:]]*=[[:space:]]*\|" $roots 2>/dev/null | grep -v '/target/')
if [ -n "$clash" ]; then
    bad "a function-typed parameter or closure local is named like a gate DSL function ($(echo "$dsl" | wc -l | tr -d ' ') names; rename one):"
    echo "$clash" | sed 's/^/       /'
else
    ok "no function-typed parameter or closure local is named like one of the $(echo "$dsl" | wc -l | tr -d ' ') DSL functions"
fi
exit $fails
