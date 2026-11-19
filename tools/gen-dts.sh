#!/bin/sh
# tools/gen-dts.sh [out] -- regenerate sae.d.ts (what a page of sae sees,
# as TypeScript) from the gate spec: `sae --gate-describe` runs the spec once
# and prints one JSON line per entry, tools/saegate renders them. Needs
# target/build/bin/sae and target/saegate (AGENTS.md "Build and test").
# tests/check_gate.sh regenerates it and compares with the checked-in file.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$ROOT/sae.d.ts}
for f in target/build/bin/sae target/saegate; do
    [ -x "$ROOT/$f" ] || { echo "gen-dts.sh: no $f (AGENTS.md \"Build and test\")" >&2; exit 2; }
done
tmp="$OUT.tmp.$$"
if SAE_NO_WINDOW=1 "$ROOT/target/build/bin/sae" --gate-describe | "$ROOT/target/saegate" > "$tmp"; then
    mv "$tmp" "$OUT"
else
    rm -f "$tmp"
    echo "gen-dts.sh: sae --gate-describe | saegate failed" >&2
    exit 1
fi
