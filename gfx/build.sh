#!/bin/sh
# gfx/build.sh: builds sae-gfx, the GPU helper (gfx/main.ae), into
# target/build/bin/sae-gfx, beside sae, where sae looks for it.
#
#   gfx/build.sh                         # against the sibling checkout ../ae3d
#   AE3D_DIR=/path/to/ae3d gfx/build.sh  # against another (a worktree of a branch)
#
# ae3d needs ae3d.batch (aether-lang-dev/ae3d#1102, branch feat/threejs-batch)
# until that merges, and its deps/aephysics submodule checked out. Linux needs
# GLFW and the system's GL; macOS draws through CGL (no window, no GLFW at
# run time), with Homebrew's GLFW to link.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
AE3D_DIR=${AE3D_DIR:-$root/../ae3d}
if [ ! -f "$AE3D_DIR/src/ae3d/batch/module.ae" ]; then
    echo "gfx/build.sh: $AE3D_DIR has no ae3d.batch (aether-lang-dev/ae3d#1102); set AE3D_DIR to an ae3d checkout of feat/threejs-batch or later" >&2
    exit 2
fi
if [ ! -f "$AE3D_DIR/deps/aephysics/aether.toml" ]; then
    echo "gfx/build.sh: $AE3D_DIR/deps/aephysics is empty (git -C $AE3D_DIR submodule update --init)" >&2
    exit 2
fi
AE3D_DIR=$(cd "$AE3D_DIR" && pwd)
ln -sfn "$AE3D_DIR" "$here/ae3d"
if [ "$(uname -s)" = Darwin ] && [ -d /opt/homebrew/lib ]; then
    export LIBRARY_PATH="/opt/homebrew/lib${LIBRARY_PATH:+:$LIBRARY_PATH}"
    export CPATH="/opt/homebrew/include${CPATH:+:$CPATH}"
fi
mkdir -p "$root/target/build/bin"
cd "$here"
ae build main.ae -o "$root/target/build/bin/sae-gfx"
echo "gfx/build.sh: $root/target/build/bin/sae-gfx (ae3d at $AE3D_DIR)"
