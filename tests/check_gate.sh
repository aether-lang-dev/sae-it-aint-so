#!/bin/sh
# tests/check_gate.sh -- the gate spec (gate_spec_ in src/sae_host.ae), the
# checked-in sae.d.ts and the objects a page really sees agree
# (docs/design/gate-dsl.md, section 4, step 2).
#
# (i)   tools/gen-dts.sh regenerates sae.d.ts from `sae --gate-describe` and
#       it is the checked-in file, byte for byte (as check_prelude.sh holds
#       src/sae_prelude.c).
# (ii)  tests/gate/dump.ts, run headless as a web page, as an app that seeks
#       and is granted everything and as an app that seeks nothing, prints
#       each global's own keys, typeof and .length; for every global and
#       member the spec describes, that is what the spec says that mode has
#       (a namespace not yet in the spec is compared with nothing).
# (iii) each entry's declared arity is its count of non-rest parameters.
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
for mode in web all none; do
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
exit $fails
