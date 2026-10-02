#!/bin/sh
# Build sae with the pinned toolchain. Usage: ./build.sh [node] (default .build.ae)
#
# SAE_AETHER_HOME is the Aether dev tree the engine and host compile against
# (default: the sibling ../aether). aeb comes from target/toolchain if
# ./toolchain.sh has installed it there, else from PATH.
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
: "${SAE_AETHER_HOME:=$(cd "$ROOT/../aether" && pwd)}"
export SAE_AETHER_HOME
export AETHER_HOME="$SAE_AETHER_HOME"
PATH="$ROOT/target/toolchain/bin:$SAE_AETHER_HOME/build:$PATH"
export PATH
cd "$ROOT"
exec aeb "${1:-.build.ae}"
