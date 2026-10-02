#!/bin/sh
# Lowerer tests.
#
#   tests/run/*.ts  lowered, then run on mquickjs-ae's mqjs: stdout must equal
#                   the file's "// expect: " lines, and the lowered text must
#                   have exactly as many lines as the source (line numbers in
#                   engine errors point at what the author wrote).
#   tests/err/*.ts  lowering must fail with the "// error: line:col: text"
#                   the file states (text is a prefix of the message).
#
# Needs target/saelower (see the README) and ../mquickjs-ae built.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOWER="$ROOT/target/saelower"
MQJS=${MQJS:-$ROOT/mqjs/target/build/bin/mqjs}
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
    "$MQJS" "$OUT/$name.js" > "$OUT/$name.actual" 2>&1
    if cmp -s "$OUT/$name.expected" "$OUT/$name.actual"; then
        pass=$((pass + 1))
    else
        echo "FAIL run/$name: output differs (expected < > actual)"
        diff "$OUT/$name.expected" "$OUT/$name.actual" | sed 's/^/    /'
        fail=$((fail + 1))
    fi
done

for t in "$ROOT"/lower/tests/err/*.ts; do
    name=$(basename "$t" .ts)
    want=$(sed -n 's|^// error: ||p' "$t")
    got=$("$LOWER" "$t" 2>&1)
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

echo "lower: $pass passed, $fail failed"
[ $fail -eq 0 ]
