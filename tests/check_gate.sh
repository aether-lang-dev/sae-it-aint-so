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
#       nothing and seeking everything as optional; an app with a sqlite
#       database and one with a native module (on its own sae, which
#       tools/saehost.sh builds); a page with the sandbox probe on; a page that
#       imports and so has $sae), prints each global's own keys, typeof and
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
# (v)   nothing registers a function a page can reach, or defines a global,
#       outside the gate DSL: reg_, glob_fn_, host_fn_, js_set_global_,
#       quickjs.set_global and quickjs.function are called only by the
#       functions of the DSL (and the layer under it), and the JavaScript the
#       kernel evaluates into a page (js_eval_, engine_eval_) only by the
#       functions listed here. A page-visible name added by a stray call
#       fails here; one added by JavaScript is caught by (ii).
#
# (vi)  the spec agrees with the other copies of what it says: the lowerer's
#       SEEKABLE (lower/module.ae: which privilege unlocks which object, less
#       clipboard-read, which gates a read in the clipboard's space), its
#       PRIVILEGED (the objects it refuses unless sought), sae_host.ae's
#       unsought_ list, and tests/spec_globals.ae's SAE_EVERY_PAGE.
#
# (vii) when a TypeScript compiler is found (SAE_TSC=<path of typescript's
#       bin/tsc, run with node>, else a `tsc` on PATH; otherwise one `skip` line
#       and nothing fails): sae.d.ts passes `tsc --strict` by itself, and each
#       page of PAGES_TSC (real pages of site/ and tests/apps/, between them
#       using every namespace, in the arrow form and the trailing-block form)
#       type-checks against it, each first desugared by `saelower --ts`
#       (tools/tscheck.sh). Other pages do not,
#       for reasons that are the page's or the compiler's setup, not the
#       declarations': docs/design/gate-dsl.md, "Step 11", lists them.
#
# Needs target/build/bin/sae and target/saegate (and target/saelower for vii).
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
    just-local-filesystem just-outgoing-http just-open-urls just-print just-documents just-clipboard just-clipboard-read just-control-bus just-backend \
    probe module just-database just-native; do
    # the names an each space has in the mode (tests/gate/dump.sh makes them)
    names=""
    case "$mode" in
        just-database) names="sqlite=notes" ;;
        just-native) names="natives=calc:sum+upper+spin+refuse" ;;
    esac
    "$GATE" --expect "$mode" --names "$names" < "$WORK/describe.jsonl" | LC_ALL=C sort > "$WORK/expect-$mode.txt"
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

# --- (v) registration only through the gate DSL ---
# callers(N): the top-level functions (sorted, space separated) that call N( in
# src/sae_host.ae, outside comments and definition lines.
callers() {
    awk -v N="$1" '
        /^[a-z_A-Z0-9]+\(/ { split($0, a, "("); fn = a[1] }
        /^[ \t]*\/\// { next }
        /^[a-z_A-Z0-9]+\(/ { next }
        index($0, N "(") { print fn }
    ' "$ROOT/src/sae_host.ae" | sort -u | tr '\n' ' '
}
expect_callers() {   # expect_callers <name> <allowed callers, sorted, space separated>
    got=$(callers "$1")
    if [ "$got" = "$2 " ]; then
        ok "$1( is called only from: $2"
    else
        bad "$1( is called from: ${got:-nowhere} -- the gate DSL's own functions are: $2"
    fi
}
expect_callers reg_ "api patch"
expect_callers glob_fn_ "global_fn"
expect_callers host_fn_ "glob_fn_ held_fn loader_fn reg_"
expect_callers js_set_global_ "gate_space_ glob_fn_"
expect_callers quickjs.set_global "js_set_global_"
expect_callers quickjs.function "host_fn_"
expect_callers js_eval_ "ae_register_ engine_eval_ http_helpers_ js_wrapper sqlite_fns_for_"
expect_callers engine_eval_ "mod_run_ modules_prepare_ page_run_"
# The app_dir half of WHEN_APP_SEEKS (an installed app has fs, shell and the
# like; a page from a file never does) is not something a dump can see: a page
# that runs has every app-only privilege it seeks as optional in p.absent
# (available_ is 0 for them without an app), so the other half already keeps the
# object out, and a mode where only this test stands cannot be made. It is held
# by its text.
if grep -q 'if cond == WHEN_APP_SEEKS && browser_of_(p).app_dir == "" { s.on = 0 }' "$ROOT/src/sae_host.ae"; then
    ok "gate_space_ still keeps an app-only space out of a page from a file (held by its text: no dump can tell)"
else
    bad "gate_space_ no longer tests app_dir for WHEN_APP_SEEKS (held by its text: no dump can tell; docs/design/gate-dsl.md, Step 11)"
fi

# --- (vi) the other copies of the privilege and global tables ---
LOWER="$ROOT/lower/module.ae"
list_of() { tr ',' '\n' | grep -v '^$' | LC_ALL=C sort -u; }
same() {   # same <label> <expected file> <seen file> <what the < and > are>
    if cmp -s "$2" "$3"; then
        ok "$1"
    else
        bad "$1 ($4):"
        diff "$2" "$3" | sed 's/^/       /'
    fi
}
"$GATE" --seeks < "$WORK/describe.jsonl" | LC_ALL=C sort -u > "$WORK/seeks.txt"
sed -n 's/^const SEEKABLE = "\(.*\)"$/\1/p' "$LOWER" | list_of > "$WORK/seekable.txt"
{ cat "$WORK/seeks.txt"; echo "clipboard-read:clipboard"; } | LC_ALL=C sort -u > "$WORK/seeks-plus.txt"
same "lower/module.ae SEEKABLE is the spec's privilege:object pairs (and clipboard-read:clipboard)" "$WORK/seeks-plus.txt" "$WORK/seekable.txt" "< spec, > SEEKABLE"
# PRIVILEGED: the objects the lowerer refuses unless sought: every sought object
# of the spec but natives (natives.x is not refused at lowering: it is a ReferenceError at run time)
sed 's/.*://' "$WORK/seeks.txt" | grep -v '^natives$' | LC_ALL=C sort -u > "$WORK/privileged-spec.txt"
sed -n 's/^const PRIVILEGED = "\(.*\)"$/\1/p' "$LOWER" | list_of > "$WORK/privileged.txt"
same "lower/module.ae PRIVILEGED is the spec's sought objects (less natives)" "$WORK/privileged-spec.txt" "$WORK/privileged.txt" "< spec, > PRIVILEGED"
# unsought_: the privileges that are one name each; database and native take a name each
sed 's/:.*//' "$WORK/seeks.txt" | grep -v -e '^database$' -e '^native$' | LC_ALL=C sort -u > "$WORK/unsought-spec.txt"
sed -n '/^unsought_(/,/^}/p' "$ROOT/src/sae_host.ae" | sed -n 's/.*string.split("\([^"]*\)".*/\1/p' | list_of | grep -v '^clipboard-read$' > "$WORK/unsought.txt"
same "sae_host.ae unsought_ lists the spec's seeks (less database and native, plus clipboard-read)" "$WORK/unsought-spec.txt" "$WORK/unsought.txt" "< spec, > unsought_"
"$GATE" --always < "$WORK/describe.jsonl" | LC_ALL=C sort -u > "$WORK/always.txt"
sed -n 's/^const SAE_EVERY_PAGE = "\(.*\)"$/\1/p' "$ROOT/tests/spec_globals.ae" | tr ' ' '\n' | grep -v '^$' | LC_ALL=C sort -u > "$WORK/every-page.txt"
same "tests/spec_globals.ae SAE_EVERY_PAGE is what the spec has in every page" "$WORK/always.txt" "$WORK/every-page.txt" "< spec, > SAE_EVERY_PAGE"

# --- (vii) tsc over sae.d.ts and real pages ---
TSC_CMD=""
if [ -n "${SAE_TSC:-}" ] && [ -f "$SAE_TSC" ] && command -v node >/dev/null 2>&1; then
    TSC_CMD="node $SAE_TSC"
elif command -v tsc >/dev/null 2>&1; then
    TSC_CMD="tsc"
fi
if [ -z "$TSC_CMD" ]; then
    echo "skip tsc: no TypeScript compiler (set SAE_TSC to typescript's bin/tsc, which needs node, or put tsc on PATH)"
else
    TSC_FLAGS="--noEmit --strict --lib es2020 --target es2020 --typeRoots /nonexistent --module es2022 --moduleResolution bundler --allowImportingTsExtensions"
    if out=$($TSC_CMD $TSC_FLAGS "$ROOT/sae.d.ts" 2>&1); then
        ok "tsc --strict: sae.d.ts ($($TSC_CMD --version))"
    else
        bad "tsc --strict: sae.d.ts does not compile:"; echo "$out" | sed 's/^/       /' | head -10
    fi
    PAGES_TSC="site/counter.ts site/form.ts site/reactive.ts site/grid.ts site/clock.ts site/vg.ts site/aevg.ts site/http.ts site/clip.ts site/seeks_fs.ts site/banking.ts site/calculator.ts site/keys.ts site/menus.ts site/widgets.ts site/a11y.ts site/raster.ts
        site/fib_clock.ts site/camera.ts site/reorder.ts site/aevg_live.ts site/dynamic.ts site/rebuild.ts site/scrolling.ts site/life.ts site/terrain.ts site/contextmenu.ts site/tooltip.ts site/about.ts
        tests/apps/sqlite_demo/index.ts tests/apps/documents/index.ts tests/apps/clipboard/index.ts tests/apps/bus/index.ts tests/apps/backend/index.ts tests/apps/natives/index.ts tests/apps/sandbox/index.ts tests/apps/menus/menus.ts tests/apps/resize/resize.ts"
    # Through tools/tscheck.sh: each page desugared by saelower --ts first, so
    # a page written with trailing blocks is held to sae.d.ts as an arrow-form
    # one is (docs/design/trailing-blocks.md).
    npages=0
    for page in $PAGES_TSC; do npages=$((npages + 1)); done
    if [ ! -x "$ROOT/target/saelower" ]; then
        bad "tsc --strict: no target/saelower to desugar the pages with (AGENTS.md \"Build and test\")"
    elif out=$(cd "$ROOT" && SAE_TSC="${SAE_TSC:-}" tools/tscheck.sh $PAGES_TSC 2>&1); then
        ok "tsc --strict: $npages real pages type-check against sae.d.ts (desugared by saelower --ts)"
    else
        echo "$out" | grep '^FAIL' | while read -r _ page rest; do bad "tsc --strict: $page does not type-check against sae.d.ts"; done
        fails=$((fails + $(echo "$out" | grep -c '^FAIL')))
        echo "$out" | grep -v '^ok' | head -30 | sed 's/^/       /'
    fi
fi
exit $fails
