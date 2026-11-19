#!/bin/sh
# Build sae. Usage: ./build.sh [node]   (default .build.ae)
#
# Toolchain: `ae` and `aeb` from PATH, as ./bootstrap.sh installs them, or an
# aeb installed privately under target/toolchain. When ../aether is an Aether
# dev tree (it has build/libaether.a), or SAE_AETHER_HOME names one, the
# engine and host compile against that tree instead, for working on the
# compiler alongside sae. SAE_AETHER_HOME=none uses the installed toolchain
# even then (how a pin bump is checked against a release).
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
. "$ROOT/tools/aether_home.sh"
sae_aether_home_ "$ROOT"
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
# into an Aether dev tree (pinned and checksummed there; `make contrib` does
# not fetch it, and a release install ships it). Whenever the build uses a
# dev tree -- SAE_AETHER_HOME, or the tree the `ae` on PATH was built in --
# run the fetch: it downloads when the amalgamation is missing (or its lock
# moved) and is a no-op with no network access otherwise.
AE_TREE=${SAE_AETHER_HOME:-}
if [ -z "$AE_TREE" ]; then
    ae_dir=$(dirname "$(command -v ae)")
    if [ -f "$ae_dir/../scripts/fetch-quickjs-amalgamation.sh" ]; then
        AE_TREE=$(cd "$ae_dir/.." && pwd)
    fi
fi
if [ -n "$AE_TREE" ] && [ -d "$AE_TREE/contrib/quickjs" ]; then
    [ -f "$AE_TREE/scripts/fetch-quickjs-amalgamation.sh" ] || {
        echo "build.sh: $AE_TREE has contrib/quickjs but no scripts/fetch-quickjs-amalgamation.sh; see pins for the Aether sae needs" >&2
        exit 1
    }
    sh "$AE_TREE/scripts/fetch-quickjs-amalgamation.sh" >/dev/null || {
        echo "build.sh: could not fetch the QuickJS amalgamation into $AE_TREE" >&2
        exit 1
    }
    [ -f "$AE_TREE/contrib/quickjs/amalgamation/quickjs-amalgam.c" ] || {
        echo "build.sh: no QuickJS amalgamation in $AE_TREE/contrib/quickjs/amalgamation after the fetch" >&2
        exit 1
    }
fi
# The page standard library's hashes (lib/sae/MANIFEST) are the build's.
sh "$ROOT/tools/hash-lib.sh"
cd "$ROOT"
aeb "${1:-.build.ae}" || exit $?
# A contained backend (docs/design/ipc-backends.md) is started with
# sandbox.spawn_socket, which preloads Aether's libaether_sandbox.so into the
# child and looks for it beside the running program first (then under
# AETHER_HOME, which a login shell may set and a service or a plain `sh -c`
# does not). So the one from the toolchain that built sae goes beside sae,
# where it is found however sae is started. Linux and FreeBSD only: nowhere
# else has the library, or contains a child.
case "$(uname -s)" in
    Linux|FreeBSD)
        lib=""
        for d in ${SAE_AETHER_HOME:+$SAE_AETHER_HOME/build} \
                 $(ae cflags --libs 2>/dev/null | tr ' ' '\n' | sed -n 's/^-L//p'); do
            for f in "$d/libaether_sandbox.so" "$d/aether/libaether_sandbox.so"; do
                [ -z "$lib" ] && [ -f "$f" ] && lib=$f
            done
        done
        if [ -n "$lib" ]; then
            cp -f "$lib" "$ROOT/target/build/bin/libaether_sandbox.so"
        else
            echo "build.sh: no libaether_sandbox.so in the toolchain ($(command -v ae)): a contained backend will not start (docs/app-backend.md)" >&2
        fi
        ;;
esac
