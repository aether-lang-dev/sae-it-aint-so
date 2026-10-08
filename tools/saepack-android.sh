#!/usr/bin/env bash
# tools/saepack-android.sh — package a sae app (a folder of pages) as an
# Android APK: saepack.sh's job, for Android.
#
#   tools/saepack-android.sh <app-dir> [out-dir]
#   AETHER_UI_WITH_DRIVER=1 tools/saepack-android.sh <app-dir>   # AetherUIDriver linked
#
# <app-dir> is what `sae --app <app-dir>` runs (index.ts, ..., app.json). The
# result is <out-dir>/<slug>.apk (out-dir defaults to target/apps).
#
# The APK is aether-ui's tools/android-apk.sh, run on sae as it is: the
# cross-compile (`ae build --target=aarch64-linux-android --emit=lib`), the
# Java shim, manifest, assets, alignment and signing are all its. sae's entry
# is its Aether main(), which android-apk.sh hands to the backend's activity
# as it does any aether-ui app's. With no arguments that main() opens the app
# it finds bundled (src/sae_host.ae, bundled_app_dir_): app/ in the working
# directory, which on Android is where the backend copies the APK's assets.
#
# android-apk.sh takes the app's assets (and its import path) from the
# directory its source is in, so this script makes that directory, named
# app/ so the pages land at app/ on the device:
#
#   target/android/<slug>/app/
#     sae.ae              -> src/sae_host.ae   (a symlink: not packed)
#     lower, services     -> sae's own         (symlinks: the host's imports)
#     index.ts, app.json  a copy of <app-dir>  (packed as assets)
#
# and passes sae's one C file, src/sae_rom.c, as ANDROID_EXTRA_SOURCES.
#
# Environment: as android-apk.sh (AETHER_SYSROOT, ANDROID_HOME, JAVA_HOME,
# AE, AETHER_UI_WITH_DRIVER, ...). ANDROID_PACKAGE defaults to
# dev.aether.sae.<slug>, ANDROID_LABEL to the app's name, and
# ANDROID_NO_INTERNET to 1 when app.json grants no capabilities.http (below).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
src="${1:?usage: saepack-android.sh <app-dir> [out-dir]}"
out="${2:-$ROOT/target/apps}"
src=$(cd "$src" && pwd)
[ -f "$src/index.ts" ] || [ -f "$src/index.js" ] || [ -f "$src/app.json" ] || {
    echo "saepack-android: $src has no index.ts, index.js or app.json" >&2; exit 1; }
AUI=$(cd "$ROOT/aether-ui" && pwd)
[ -x "$AUI/tools/android-apk.sh" ] || { echo "saepack-android: no $AUI/tools/android-apk.sh" >&2; exit 1; }

name=""
if [ -f "$src/app.json" ]; then
    name=$(plutil -extract name raw -o - "$src/app.json" 2>/dev/null || true)
fi
[ -n "$name" ] || name=$(basename "$src")
slug=$(printf '%s' "$name" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_\n' '_' | sed 's/^_*//;s/_*$//')
[ -n "$slug" ] || slug=app

work="$ROOT/target/android/$slug"
stage="$work/app"
rm -rf "$work"
mkdir -p "$work" "$out"
cp -R "$src" "$stage"
ln -s "$ROOT/src/sae_host.ae" "$stage/sae.ae"
ln -s "$ROOT/lower" "$stage/lower"
ln -s "$ROOT/services" "$stage/services"

# The INTERNET permission follows app.json capabilities.http (README, App
# mode): an app without it, or with an empty one, can reach nothing at all,
# so its APK does not ask for the permission either (android-apk.sh's
# ANDROID_NO_INTERNET).
# Not with AETHER_UI_WITH_DRIVER: the driver is a socket server the specs
# reach over adb's forward, and a socket needs INTERNET; android-apk.sh
# refuses the two together. An ANDROID_NO_INTERNET already set is kept.
http_grants=""
if [ -f "$src/app.json" ]; then
    http_grants=$(plutil -extract capabilities.http json -o - "$src/app.json" 2>/dev/null || true)
fi
case "$http_grants" in
    ""|"[]"|"[ ]")
        if [ -z "${AETHER_UI_WITH_DRIVER:-}" ] && [ -z "${ANDROID_NO_INTERNET:-}" ]; then
            export ANDROID_NO_INTERNET=1
            echo "saepack-android: app.json grants no capabilities.http: no INTERNET permission"
        fi ;;
esac

export ANDROID_PACKAGE="${ANDROID_PACKAGE:-dev.aether.sae.$slug}"
export ANDROID_LABEL="${ANDROID_LABEL:-$name}"
export ANDROID_EXTRA_SOURCES="$ROOT/src/sae_rom.c"
"$AUI/tools/android-apk.sh" "$stage/sae.ae"
apk="$AUI/target/android/sae/sae.apk"
[ -f "$apk" ] || { echo "saepack-android: no APK at $apk" >&2; exit 1; }
cp "$apk" "$out/$slug.apk"
echo "saepack-android: $out/$slug.apk (package $ANDROID_PACKAGE)"
