#!/bin/sh
# tests/check_natives.sh — the rules tools/saenatives.ae holds an app's
# native modules to (docs/natives.md), headless: a module that needs a
# capability (files, extern C, the clock), a program with main, a declared
# function the module does not export or that does not take one string and
# give two, and an app.json path that leaves the app, are each refused with
# why, and nothing is written; a module that only computes is taken, and
# the dispatch module written for it; and (on a Mac with Xcode) a module
# compiles for iOS as a static library granted no capability.
#
# Exit status: the number of failed checks.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 1
if [ "${SAE_AETHER_HOME:-}" = none ]; then
    unset SAE_AETHER_HOME
elif [ -z "${SAE_AETHER_HOME:-}" ] && [ -f "$ROOT/../aether/build/libaether.a" ]; then
    SAE_AETHER_HOME=$(cd "$ROOT/../aether" && pwd)
fi
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"
fails=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

tool="$ROOT/target/saenatives"
if [ ! -x "$tool" ] || [ "$ROOT/tools/saenatives.ae" -nt "$tool" ]; then
    ae build "$ROOT/tools/saenatives.ae" -o "$tool" >/dev/null 2>&1 || { bad "tools/saenatives.ae builds"; exit 1; }
fi
work="$ROOT/target/natives-check"
rm -rf "$work" && mkdir -p "$work"

# app NAME FUNCTIONS(json list) MODULE-PATH (the module's source on stdin)
app() {
    mkdir -p "$work/$1/native"
    printf '{ "name": "%s", "natives": { "m": { "module": "%s", "functions": %s } } }\n' "$1" "$3" "$2" > "$work/$1/app.json"
    cat > "$work/$1/native/m.ae"
}
# refused NAME EXPECTED-TEXT LABEL
refused() {
    out=$("$tool" "$work/$1" "$work/$1-stage" 2>&1)
    status=$?
    if [ $status -ne 0 ] && printf '%s' "$out" | grep -qF "$2" && [ ! -e "$work/$1-stage/natives/module.ae" ]; then
        ok "$3"
    else
        bad "$3 (status $status: $out)"
    fi
}

app files '["read"]' native/m.ae <<'X'
import std.fs
exports (read)
read(arg: string) -> (string, string) {
    t, e = fs.read(arg)
    return t, e
}
X
refused files "needs a capability (capabilities required (gated imports): fs)" "a module that reads files is refused"

app cee '["now"]' native/m.ae <<'X'
extern time(t: ptr) -> int
exports (now)
now(arg: string) -> (string, string) {
    return "${time(null)}", ""
}
X
refused cee "needs a capability" "a module that names C (extern) is refused"

app clock '["now"]' native/m.ae <<'X'
import std.os
exports (now)
now(arg: string) -> (string, string) {
    return "${os.now_monotonic_ms()}", ""
}
X
refused clock "needs a capability" "a module that reads the clock (std.os) is refused"

app prog '["f"]' native/m.ae <<'X'
f(arg: string) -> (string, string) { return arg, "" }
main() { println("hello") }
X
refused prog "is a program (it has main), not a module" "a program is refused"

app missing '["f", "g"]' native/m.ae <<'X'
exports (f)
f(arg: string) -> (string, string) { return arg, "" }
g(arg: string) -> (string, string) { return arg, "" }
X
refused missing "does not export g, which app.json declares" "a declared function it does not export is refused"

app shape '["f"]' native/m.ae <<'X'
exports (f)
f(n: int) -> int { return n }
X
refused shape "a native function takes one string and gives two" "a function of another shape is refused"

app outside '["f"]' ../m.ae <<'X'
exports (f)
f(arg: string) -> (string, string) { return arg, "" }
X
refused outside "a .ae file inside the app" "a module path that leaves the app is refused"

app good '["f"]' native/m.ae <<'X'
import std.string
exports (f, unlisted)
f(arg: string) -> (string, string) { return string.to_upper(arg), "" }
unlisted(arg: string) -> (string, string) { return arg, "" }
X
out=$("$tool" "$work/good" "$work/good-stage" 2>&1)
if [ $? -eq 0 ] && grep -qF 'return ",m.f,"' "$work/good-stage/natives/module.ae" \
   && grep -qF 'import app_natives.m as native_m' "$work/good-stage/natives/module.ae" \
   && ! grep -q unlisted "$work/good-stage/natives/module.ae" \
   && cmp -s "$work/good/native/m.ae" "$work/good-stage/app_natives/m/module.ae"; then
    ok "a module that only computes is taken: copied, and dispatched to for its declared functions only"
else
    bad "a module that only computes is taken ($out)"
fi
# On a Mac with Xcode: a native module compiles for the phone as it is, a
# static library granted no capability (docs/natives.md, "iOS").
if [ "$(uname -s)" = Darwin ] && xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
    if ae build tests/apps/natives/native/calc.ae --target aarch64-ios --emit=staticlib --with= -o "$work/libcalc-ios.a" >"$work/ios.log" 2>&1 \
       && lipo -info "$work/libcalc-ios.a" 2>/dev/null | grep -q arm64; then
        ok "the demo's module compiles for iOS (aarch64-ios, a static library, no capability granted)"
    else
        bad "the demo's module compiles for iOS ($(tail -3 "$work/ios.log"))"
    fi
else
    echo "skip the iOS compile: no Xcode iOS SDK here"
fi
# The stub sae's own tree has: none.
if grep -qF 'return ","' natives/module.ae; then ok "sae's own natives/module.ae is the stub with none"; else bad "natives/module.ae is not the stub"; fi
exit $fails
