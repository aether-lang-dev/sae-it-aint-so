#!/bin/sh
# tools/hash-lib.sh — write lib/sae/MANIFEST: "<name> <sha256>" per library
# module, the hashes services/stdlib checks each module against when a page
# imports it. ./build.sh runs this, so the manifest is the build's; run it by
# hand after editing a module to test without a full build.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LIB="$ROOT/lib/sae"
if command -v shasum >/dev/null 2>&1; then
    digest() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
    digest() { sha256sum "$1" | cut -d' ' -f1; }
fi
out="$LIB/MANIFEST.tmp"
: > "$out"
for f in "$LIB"/*.ts; do
    printf '%s %s\n' "$(basename "$f" .ts)" "$(digest "$f")" >> "$out"
done
if [ -f "$LIB/MANIFEST" ] && cmp -s "$out" "$LIB/MANIFEST"; then
    rm -f "$out"
else
    mv "$out" "$LIB/MANIFEST"
fi
