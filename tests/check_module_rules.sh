#!/bin/sh
# tests/check_module_rules.sh — the module loader's rules that need no
# window (README "Modules"): each case is a page run headless
# (SAE_NO_WINDOW=1), and must be refused (exit 1) with the given reason on
# the console, or run (exit 0) with the given output. Covers what the
# browser specs cannot reach: pages loaded from files, an app's refusals
# past the first (an app has no Back chrome), and the sae: library's
# manifest check with a tampered copy of lib/sae.
#
# Needs target/build/bin/sae.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SAE="$ROOT/target/build/bin/sae"
WORK="$ROOT/target/module-rules"
rm -rf "$WORK" && mkdir -p "$WORK/site/sub" "$WORK/lib-tampered" "$WORK/lib-stale"
fails=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# expect <name> <exit> <text> -- <sae args>: the run exits as said and its
# output has the text.
expect() {
    name=$1; want=$2; text=$3; shift 3; [ "$1" = -- ] && shift
    out=$(cd "$WORK" && SAE_NO_WINDOW=1 "$SAE" "$@" 2>&1); got=$?
    if [ "$got" -ne "$want" ]; then
        bad "$name: exit $got, wanted $want: $out"
    elif ! printf '%s' "$out" | grep -qF -- "$text"; then
        bad "$name: output lacks '$text': $out"
    else
        ok "$name"
    fi
}

# --- pages loaded from files: the folder is the origin ---
cat > "$WORK/site/page.ts" <<'TS'
import { k } from "./sub/k.ts";
import { lerp } from "sae:easing";
print("file page:", k, lerp(0, 10, 0.25));
TS
echo 'export const k = "kay";' > "$WORK/site/sub/k.ts"
echo 'import { k } from "../secret.ts"; print(k);' > "$WORK/site/escape.ts"
echo 'export const k = "secret";' > "$WORK/secret.ts"
echo 'import { k } from "/etc/passwd"; print(k);' > "$WORK/site/absolute.ts"
echo 'import { k } from "http://127.0.0.1:1/x.ts"; print(k);' > "$WORK/site/http.ts"
echo 'import { k } from "lodash"; print(k);' > "$WORK/site/bare.ts"
echo 'import { k } from "file:///etc/passwd"; print(k);' > "$WORK/site/scheme.ts"
echo 'import { k } from "./sub/k.ts#sha256-abc"; print(k);' > "$WORK/site/badhash.ts"
H=$(cd "$WORK/site" && (shasum -a 256 sub/k.ts 2>/dev/null || sha256sum sub/k.ts) | cut -d' ' -f1)
echo "import { k } from \"./sub/k.ts#sha256-$H\"; print(\"hash\", k);" > "$WORK/site/goodhash.ts"
echo 'import { nope } from "sae:nope"; print(nope);' > "$WORK/site/nolib.ts"
echo 'import { x } from "sae:../noise"; print(x);' > "$WORK/site/libname.ts"
printf 'print("no newline at the end");\nawait Promise.resolve();\nprint("after")' > "$WORK/site/noeol.ts"

expect "file page imports from its folder and sae:" 0 "file page: kay 2.5" -- site/page.ts
expect "a file page cannot import above its folder" 1 "is outside this page's folder (site/)" -- site/escape.ts
expect "nor an absolute path" 1 "is outside this page's folder" -- site/absolute.ts
expect "nor http" 1 "a page loaded from a file imports only from its own folder" -- site/http.ts
expect "no bare names" 1 "no bare names (there is no npm here)" -- site/bare.ts
expect "no other scheme" 1 "cannot be imported" -- site/scheme.ts
expect "a malformed hash is refused" 1 "#sha256- takes 64 hex digits" -- site/badhash.ts
expect "a matching hash passes" 0 "hash kay" -- site/goodhash.ts
expect "a library module that does not exist" 1 "sae:nope: no such library module" -- site/nolib.ts
expect "a library name is letters, digits and dashes" 1 "is not a library module name" -- site/libname.ts
expect "a page without a final newline still wraps" 0 "after" -- site/noeol.ts

# --- the sae: library is what was built: a tampered module is refused ---
cp "$ROOT/lib/sae/"* "$WORK/lib-tampered/"
printf '\n// edited after the build\n' >> "$WORK/lib-tampered/easing.ts"
out=$(cd "$WORK" && SAE_NO_WINDOW=1 SAE_LIB_DIR="$WORK/lib-tampered" "$SAE" site/page.ts 2>&1); got=$?
if [ "$got" -eq 1 ] && printf '%s' "$out" | grep -q "sae:easing does not match lib/sae/MANIFEST"; then
    ok "a library module changed after the build is refused"
else
    bad "a library module changed after the build is refused: exit $got: $out"
fi
cp "$ROOT/lib/sae/"*.ts "$WORK/lib-stale/"
out=$(cd "$WORK" && SAE_NO_WINDOW=1 SAE_LIB_DIR="$WORK/lib-stale" "$SAE" site/page.ts 2>&1); got=$?
if [ "$got" -eq 1 ] && printf '%s' "$out" | grep -q "is not in lib/sae/MANIFEST"; then
    ok "a lib directory without a manifest serves nothing"
else
    bad "a lib directory without a manifest serves nothing: exit $got: $out"
fi
if ! sh "$ROOT/tools/hash-lib.sh" || ! git -C "$ROOT" diff --quiet -- lib/sae/MANIFEST; then
    bad "lib/sae/MANIFEST is stale: run tools/hash-lib.sh and commit it"
else
    ok "lib/sae/MANIFEST matches lib/sae/*.ts"
fi

# --- an app: its bundle and sae:, nothing else ---
APP="$ROOT/tests/apps/imports"
expect "an app page imports from its bundle" 0 "" -- --app "$APP"
cp "$APP/app.json" "$WORK/app.json.bak"
for page in outside escape; do
    sed "s|\"start\": \"/\"|\"start\": \"/$page\"|" "$WORK/app.json.bak" > "$APP/app.json"
    case $page in
        outside) expect "an app refuses an http import" 1 "an app imports only from its own bundle" -- --app "$APP" ;;
        escape) expect "an app refuses an import that climbs out of its bundle" 1 "climbs above the app's bundle" -- --app "$APP" ;;
    esac
done
cp "$WORK/app.json.bak" "$APP/app.json"

echo "module rules: $fails failed"
exit $fails
