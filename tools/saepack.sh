#!/usr/bin/env bash
# tools/saepack.sh — package a sae app (a folder of pages) as a macOS .app.
#
#   tools/saepack.sh <app-dir> [out-dir] [bundle.identifier]
#
# The bundle identifier (default dev.aether.sae.<name>) is what the app's
# storage is keyed by at run time: give two apps with the same name
# different ones.
#
# <app-dir> is what `sae --app <app-dir>` runs: its pages (index.ts, ...) and an
# optional app.json ({ "name", "start", "width", "height" }). The result is
# <out-dir>/<name>.app (out-dir defaults to target/apps):
#
#   Contents/MacOS/<Exe>        sae's release binary (target/build/bin/sae)
#   Contents/Resources/app/     the app's pages; the binary finds them beside
#                               itself and starts in app mode, with no chrome
#   Contents/Frameworks/        the non-system dylibs sae links (Homebrew's
#                               OpenSSL, nghttp2, pcre2), load paths rewritten
#                               to @executable_path, so the app runs on a Mac
#                               without Homebrew
#   Contents/Info.plist
#
# signed ad hoc (`codesign --sign -`), which Apple silicon needs to launch it.
# Not notarized: distributing outside the App Store needs a Developer ID
# certificate and notarytool. (The bundle layout and plist follow macae's
# tools/mkapp.sh.)
#
# The pages ship as written; sae lowers them in-process when they load (well
# under a millisecond a page).
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
src="${1:?usage: saepack.sh <app-dir> [out-dir] [bundle.id]}"
out="${2:-$ROOT/target/apps}"
src=$(cd "$src" && pwd)
bin="$ROOT/target/build/bin/sae"
[ -x "$bin" ] || { echo "saepack: no $bin; run ./build.sh first" >&2; exit 1; }
[ -f "$src/index.ts" ] || [ -f "$src/index.js" ] || [ -f "$src/app.json" ] || {
    echo "saepack: $src has no index.ts, index.js or app.json" >&2; exit 1; }

name=""
if [ -f "$src/app.json" ]; then
    name=$(plutil -extract name raw -o - "$src/app.json" 2>/dev/null || true)
fi
[ -n "$name" ] || name=$(basename "$src")
exe=$(printf '%s' "$name" | tr -cd 'A-Za-z0-9._-')
[ -n "$exe" ] || exe=app
slug=$(printf '%s' "$exe" | tr 'A-Z' 'a-z')
bid="${3:-dev.aether.sae.$slug}"

app="$out/$name.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" "$app/Contents/Frameworks"
cp "$bin" "$app/Contents/MacOS/$exe"
chmod +x "$app/Contents/MacOS/$exe"
cp -R "$src" "$app/Contents/Resources/app"

# Bundle the dylibs sae links from outside the OS, and point every load path
# (the binary's, and theirs on each other) at the bundled copies.
nonsys() { otool -L "$1" | tail -n +2 | awk '{print $1}' | grep -E '^/(opt|usr/local)/' || true; }
fw="$app/Contents/Frameworks"
queue=$(nonsys "$bin")
done_list=""
while [ -n "$queue" ]; do
    next=""
    for lib in $queue; do
        case " $done_list " in *" $lib "*) continue ;; esac
        done_list="$done_list $lib"
        cp "$lib" "$fw/"
        chmod u+w "$fw/$(basename "$lib")"
        next="$next $(nonsys "$lib")"
    done
    queue=$(printf '%s\n' $next | sort -u | tr '\n' ' ')
    queue=$(printf '%s' "$queue" | sed 's/^ *//;s/ *$//')
done
for lib in $done_list; do
    base=$(basename "$lib")
    install_name_tool -change "$lib" "@executable_path/../Frameworks/$base" "$app/Contents/MacOS/$exe" 2>/dev/null
    install_name_tool -id "@executable_path/../Frameworks/$base" "$fw/$base" 2>/dev/null
    for other in $done_list; do
        install_name_tool -change "$other" "@executable_path/../Frameworks/$(basename "$other")" "$fw/$base" 2>/dev/null
    done
done

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleExecutable</key><string>$exe</string>
    <key>CFBundleIdentifier</key><string>$bid</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$name</string>
    <key>CFBundleDisplayName</key><string>$name</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# No entitlements: the app is not sandboxed, and app.json capabilities.http
# is enforced by sae itself. A sandboxed (Mac App Store) build would add
# com.apple.security.network.client exactly when that list is not empty.
codesign --force --sign - "$fw"/*.dylib 2>/dev/null || true
codesign --force --sign - "$app"
echo "saepack: $app"
