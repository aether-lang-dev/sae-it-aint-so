#!/bin/sh
# Bring in everything sae builds from, on a machine that has none of it:
#
#   1. `ae` and `aeb`, pinned, through aeb's get.sh (binary-first, into
#      $PREFIX, default ~/.local). The same one-liner selaenium documents.
#   2. The sibling checkouts sae's symlinks point at: ../aether-ui and
#      ../mquickjs-ae, cloned at their pinned commits. A sibling that already
#      exists is left as it is (it may be your working copy).
#
# Versions come from ./pins. Then: ./build.sh
#
#   SAE_SKIP_TOOLCHAIN=1  keep whatever ae/aeb are already on PATH
set -eu
ROOT=$(cd "$(dirname "$0")" && pwd)
PARENT=$(cd "$ROOT/.." && pwd)
. "$ROOT/pins"

say() { echo "sae bootstrap: $*"; }

if [ "${SAE_SKIP_TOOLCHAIN:-0}" != 1 ]; then
    command -v curl >/dev/null 2>&1 || { say "curl is required"; exit 1; }
    say "installing ae $AE_PIN and aeb $AEB_REF"
    curl -fsSL https://raw.githubusercontent.com/aether-lang-dev/aeb/main/get.sh \
        | AE_PIN="$AE_PIN" AEB_REF="$AEB_REF" sh
    # get.sh installs into $PREFIX/bin; make that visible to the steps below
    # (and say so, since the caller's shell will need it too).
    BIN="${PREFIX:-$HOME/.local}/bin"
    case ":$PATH:" in
        *":$BIN:"*) ;;
        *) PATH="$BIN:$PATH"; export PATH; say "add $BIN to your PATH" ;;
    esac
fi

clone() {
    dir=$1 url=$2 ref=$3
    if [ -e "$PARENT/$dir" ]; then
        say "../$dir exists, leaving it alone (sae is tested at $ref)"
        return
    fi
    say "cloning $url at $ref into ../$dir"
    git clone -q "$url" "$PARENT/$dir"
    git -C "$PARENT/$dir" -c advice.detachedHead=false checkout -q "$ref"
}
command -v git >/dev/null 2>&1 || { say "git is required"; exit 1; }
clone aether-ui "$AETHER_UI_URL" "$AETHER_UI_REF"
clone mquickjs-ae "$MQUICKJS_AE_URL" "$MQUICKJS_AE_REF"

say "done; now ./build.sh"
