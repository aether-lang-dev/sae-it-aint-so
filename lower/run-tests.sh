#!/bin/sh
# Lowerer tests.
#
#   tests/run/*.ts  lowered, then run on sae's engine (target/saejs, QuickJS
#                   via contrib.quickjs): stdout must equal
#                   the file's "// expect: " lines, and the lowered text must
#                   have exactly as many lines as the source (line numbers in
#                   engine errors point at what the author wrote).
#   tests/err/*.ts  lowering must fail with the "// error: line:col: text"
#                   the file states (text is a prefix of the message);
#                   err/module_*.ts are lowered as modules.
#   tests/mod/*.ts  pages with imports: each is lowered, its import closure
#                   (./lib/*.ts beside it, sae:* from lib/sae) lowered as
#                   modules, and all of it run on the engine behind
#                   tests/mod/harness.js, a JavaScript stand-in for the
#                   host's loader object; "// expect:" lines and the line
#                   count as for run/. tests/mod/golden/*.ts are lowered and
#                   compared with their .js, the exact rewrite.
#
# Needs target/saelower and target/saejs (see the README).
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOWER="$ROOT/target/saelower"
SAEJS=${SAEJS:-$ROOT/target/saejs}
OUT="$ROOT/target/lower-tests"
mkdir -p "$OUT"
pass=0
fail=0

for t in "$ROOT"/lower/tests/run/*.ts; do
    name=$(basename "$t" .ts)
    if ! "$LOWER" "$t" > "$OUT/$name.js" 2> "$OUT/$name.err"; then
        echo "FAIL run/$name: lowering failed: $(cat "$OUT/$name.js" "$OUT/$name.err")"
        fail=$((fail + 1))
        continue
    fi
    src_lines=$(wc -l < "$t")
    out_lines=$(wc -l < "$OUT/$name.js")
    if [ "$src_lines" -ne "$out_lines" ]; then
        echo "FAIL run/$name: $src_lines source lines became $out_lines"
        fail=$((fail + 1))
        continue
    fi
    sed -n 's|^// expect: ||p' "$t" > "$OUT/$name.expected"
    "$SAEJS" "$OUT/$name.js" > "$OUT/$name.actual" 2>&1
    if cmp -s "$OUT/$name.expected" "$OUT/$name.actual"; then
        pass=$((pass + 1))
    else
        echo "FAIL run/$name: output differs (expected < > actual)"
        diff "$OUT/$name.expected" "$OUT/$name.actual" | sed 's/^/    /'
        fail=$((fail + 1))
    fi
done

# An err/module_*.ts is lowered as a module (--module).
for t in "$ROOT"/lower/tests/err/*.ts; do
    name=$(basename "$t" .ts)
    want=$(sed -n 's|^// error: ||p' "$t")
    mode=""
    case "$name" in module_*) mode="--module" ;; esac
    got=$("$LOWER" $mode "$t" 2>&1)
    status=$?
    # strip the "path:" prefix, keep "line:col: message"
    got=${got#"$t:"}
    case "$got" in
        "$want"*)
            if [ $status -eq 1 ]; then
                pass=$((pass + 1))
            else
                echo "FAIL err/$name: exit status $status, wanted 1"
                fail=$((fail + 1))
            fi
            ;;
        *)
            echo "FAIL err/$name"
            echo "    wanted: $want"
            echo "    got:    $got"
            fail=$((fail + 1))
            ;;
    esac
done

# --- modules: pages with imports, run behind the harness ---

# Lower the module a specifier names (relative to the importer's key, a
# path under tests/mod, or sae:) and the modules it imports first, once
# each, appending to the bundle $1. Positional parameters only: sh has no
# locals and the function recurses.
loaded=""
load_module() {   # load_module BUNDLE IMPORTER-KEY SPEC
    case "$3" in
        sae:*) set -- "$1" "$3" "$ROOT/lib/sae/${3#sae:}.ts" ;;
        *) set -- "$1" "$(cd "$ROOT/lower/tests/mod/$(dirname "$2")" && cd "$(dirname "$3")" && pwd)/$(basename "$3")" ;;
    esac
    case "$2" in
        sae:*) ;;
        *) set -- "$1" "${2#$ROOT/lower/tests/mod/}" "$2" ;;
    esac
    # now: $1 bundle, $2 key, $3 file
    case " $loaded " in *" $2 "*) return 0 ;; esac
    loaded="$loaded $2"
    # A module the lowerer cannot read has no import list: say so, rather
    # than taking the words of its error for module names.
    if ! imports=$("$LOWER" --module-imports "$3" 2>&1); then
        echo "  cannot lower $2: $imports"
        return 1
    fi
    for s in $(printf '%s\n' "$imports" | cut -f1); do
        load_module "$1" "$2" "$s" || return 1
    done
    if ! "$LOWER" --module "$3" > "$OUT/mod.js" 2>&1; then
        echo "  cannot lower $2: $(cat "$OUT/mod.js")"
        return 1
    fi
    { printf '__module("%s", ' "$2"; cat "$OUT/mod.js"; echo ");"; } >> "$1"
}

for t in "$ROOT"/lower/tests/mod/*.ts; do
    name=$(basename "$t" .ts)
    if ! "$LOWER" "$t" > "$OUT/mod_$name.page.js" 2> "$OUT/mod_$name.err"; then
        echo "FAIL mod/$name: lowering failed: $(cat "$OUT/mod_$name.page.js" "$OUT/mod_$name.err")"
        fail=$((fail + 1))
        continue
    fi
    src_lines=$(wc -l < "$t")
    out_lines=$(wc -l < "$OUT/mod_$name.page.js")
    if [ "$src_lines" -ne "$out_lines" ]; then
        echo "FAIL mod/$name: $src_lines source lines became $out_lines"
        fail=$((fail + 1))
        continue
    fi
    bundle="$OUT/mod_$name.js"
    cp "$ROOT/lower/tests/mod/harness.js" "$bundle"
    loaded=""
    ok=1
    for s in $("$LOWER" --imports "$t" | cut -f1); do
        load_module "$bundle" "$name.ts" "$s" || ok=0
    done
    if [ $ok -eq 0 ]; then
        echo "FAIL mod/$name: a module could not be lowered"
        fail=$((fail + 1))
        continue
    fi
    { printf '__page("%s", ' "$name.ts"; cat "$OUT/mod_$name.page.js"; echo ");"; } >> "$bundle"
    sed -n 's|^// expect: ||p' "$t" > "$OUT/mod_$name.expected"
    "$SAEJS" "$bundle" > "$OUT/mod_$name.actual" 2>&1
    if cmp -s "$OUT/mod_$name.expected" "$OUT/mod_$name.actual"; then
        pass=$((pass + 1))
    else
        echo "FAIL mod/$name: output differs (expected < > actual)"
        diff "$OUT/mod_$name.expected" "$OUT/mod_$name.actual" | sed 's/^/    /'
        fail=$((fail + 1))
    fi
done

# --- golden: the exact rewrite ---

for t in "$ROOT"/lower/tests/mod/golden/*.ts; do
    name=$(basename "$t" .ts)
    mode=""
    case "$name" in module_*) mode="--module" ;; esac
    if ! "$LOWER" $mode "$t" > "$OUT/golden_$name.js" 2>&1; then
        echo "FAIL golden/$name: lowering failed: $(cat "$OUT/golden_$name.js")"
        fail=$((fail + 1))
    elif cmp -s "${t%.ts}.js" "$OUT/golden_$name.js"; then
        pass=$((pass + 1))
    else
        echo "FAIL golden/$name: rewrite differs (expected < > actual)"
        diff "${t%.ts}.js" "$OUT/golden_$name.js" | sed 's/^/    /'
        fail=$((fail + 1))
    fi
done

echo "lower: $pass passed, $fail failed"
[ $fail -eq 0 ]
