#!/bin/sh
# Build sae. Usage: ./build.sh [node]   (default .build.ae)
#
# Toolchain: `ae` and `aeb` from PATH, as ./bootstrap.sh installs them, or an
# aeb installed privately under target/toolchain. When ../aether is an Aether
# dev tree (it has build/libaether.a), or SAE_AETHER_HOME names one, the
# engine and host compile against that tree instead, for working on the
# compiler alongside sae.
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
if [ -z "${SAE_AETHER_HOME:-}" ] && [ -f "$ROOT/../aether/build/libaether.a" ]; then
    SAE_AETHER_HOME=$(cd "$ROOT/../aether" && pwd)
fi
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export SAE_AETHER_HOME
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"
export PATH
for tool in ae aeb; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "build.sh: no '$tool' on PATH; run ./bootstrap.sh first (see README)" >&2
        exit 1
    }
done
for dep in aether-ui; do
    [ -e "$ROOT/$dep/" ] || {
        echo "build.sh: $dep/ does not resolve (a sibling checkout is missing); run ./bootstrap.sh" >&2
        exit 1
    }
done
# The page engine is contrib.quickjs, whose QuickJS amalgamation is fetched
# into the Aether tree (pinned and checksummed there); a no-op once fetched.
if [ -n "${SAE_AETHER_HOME:-}" ] && [ -f "$SAE_AETHER_HOME/scripts/fetch-quickjs-amalgamation.sh" ]; then
    sh "$SAE_AETHER_HOME/scripts/fetch-quickjs-amalgamation.sh" >/dev/null || {
        echo "build.sh: could not fetch the QuickJS amalgamation into $SAE_AETHER_HOME" >&2
        exit 1
    }
fi
cd "$ROOT"
exec aeb "${1:-.build.ae}"
