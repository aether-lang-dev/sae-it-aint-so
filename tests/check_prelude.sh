#!/bin/sh
# tests/check_prelude.sh -- src/sae_prelude.c is what tools/embed-prelude.sh
# makes of src/sae_prelude.js (the prelude a page runs is the one in the
# source tree), and the prelude parses on sae's engine.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
tmp="$ROOT/target/prelude-check.c"
mkdir -p "$ROOT/target"
"$ROOT/tools/embed-prelude.sh" "$tmp"
if cmp -s "$tmp" "$ROOT/src/sae_prelude.c"; then
    echo "ok   src/sae_prelude.c matches src/sae_prelude.js"
else
    echo "FAIL src/sae_prelude.c is stale: run tools/embed-prelude.sh"
    exit 1
fi
if [ -x "$ROOT/target/saejs" ]; then
    if "$ROOT/target/saejs" "$ROOT/src/sae_prelude.js" >/dev/null 2>"$ROOT/target/prelude-check.log"; then
        echo "ok   the prelude parses on the engine"
    else
        # It references ui/vg, absent in saejs: only a SyntaxError counts.
        if grep -q SyntaxError "$ROOT/target/prelude-check.log"; then
            echo "FAIL the prelude does not parse:"; cat "$ROOT/target/prelude-check.log"; exit 1
        fi
        echo "ok   the prelude parses on the engine"
    fi
fi
exit 0
