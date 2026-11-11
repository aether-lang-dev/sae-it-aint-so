#!/bin/sh
# Build the image tests/apps/backend_wslc runs, sae-backend-test:dev:
# tests/apps/backend's test backend compiled for Linux, with the Aether that
# sae's pins file names, inside the image (no Linux toolchain needed here).
# Run on Windows 11, where wslc is (MSYS2 or Git Bash):
#   sh tests/apps/backend_wslc/build-image.sh
#   AETHER_REF=main sh tests/apps/backend_wslc/build-image.sh   # Aether from source
# tests/run_all.sh runs it on Windows before spec_app_backend_wslc.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
AE_PIN=$(sed -n 's/^AE_PIN=//p' "$ROOT/pins")
CTX="$ROOT/target/backend-wslc-image"
rm -rf "$CTX"
mkdir -p "$CTX/sdk"
cp "$HERE/Dockerfile" "$CTX/Dockerfile"
cp "$ROOT/tests/apps/backend/backend/main.ae" "$CTX/main.ae"
cp -R "$ROOT/sdk/saebackend" "$CTX/sdk/saebackend"
command -v wslc >/dev/null 2>&1 || PATH="$PATH:/c/Program Files/WSL"
wslc build -t sae-backend-test:dev --build-arg "AE_PIN=$AE_PIN" \
    --build-arg "AETHER_REF=${AETHER_REF:-}" "$CTX"
