#!/bin/sh
# tools/tscheck.sh -- type-check pages in either form of the dialect against
# sae.d.ts with tsc (docs/design/trailing-blocks.md, "Type-checking").
#
#   tools/tscheck.sh site/clock.ts site/fib_clock.ts ...
#
# A trailing block is not TypeScript, so each page, and every .ts file in its
# directory and below (the modules it imports), is first put through
# `saelower --ts` (the desugar alone; types, import and export kept, lines
# where they were) into a mirror under target/, and tsc --strict reads the
# mirror with sae.d.ts. Messages name the page's own path; a column on a line
# with a block is the desugared line's (a few characters right of the
# source's). A file the desugar refuses is reported as such.
#
# Prints "ok <page>" or "FAIL <page>" and tsc's messages, per page; the exit
# status is the number of pages that failed (2 with no tsc or no saelower).
# The compiler: SAE_TSC=<typescript's bin/tsc, run with node>, else a tsc on
# PATH. Needs target/saelower.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOWER="$ROOT/target/saelower"
[ -x "$LOWER" ] || { echo "tscheck: no target/saelower (AGENTS.md \"Build and test\")"; exit 2; }
TSC_CMD=""
if [ -n "${SAE_TSC:-}" ] && [ -f "$SAE_TSC" ] && command -v node >/dev/null 2>&1; then
    TSC_CMD="node $SAE_TSC"
elif command -v tsc >/dev/null 2>&1; then
    TSC_CMD="tsc"
fi
[ -n "$TSC_CMD" ] || { echo "tscheck: no TypeScript compiler (set SAE_TSC to typescript's bin/tsc, or put tsc on PATH)"; exit 2; }
TSC_FLAGS="--noEmit --strict --lib es2020 --target es2020 --typeRoots /nonexistent --module es2022 --moduleResolution bundler --allowImportingTsExtensions"

mkdir -p "$ROOT/target" || exit 2
MIRROR=$(mktemp -d "$ROOT/target/tscheck.XXXXXX") || exit 2
trap 'rm -rf "$MIRROR"' EXIT
trap 'exit 130' INT
cp "$ROOT/sae.d.ts" "$MIRROR/sae.d.ts"

# Desugar one file to its mirror path: as a page if it is one of the pages
# named, else as a module, else as a page (a page beside the one checked).
desugar() {   # desugar SRC DEST AS-PAGE
    mkdir -p "$(dirname "$2")"
    if [ "$3" = 1 ]; then
        "$LOWER" --ts "$1" > "$2" 2>&1 && return 0
    else
        "$LOWER" --ts-module "$1" > "$2" 2>/dev/null && return 0
        "$LOWER" --ts "$1" > "$2" 2>&1 && return 0
    fi
    return 1
}

done_dirs=" "
fails=0
for page in "$@"; do
    dir=$(cd "$(dirname "$page")" && pwd) || { echo "FAIL $page: no such directory"; fails=$((fails + 1)); continue; }
    # mirror the page's directory once (pages and modules beside it)
    case "$done_dirs" in *" $dir "*) ;; *)
        done_dirs="$done_dirs$dir "
        for f in $(cd "$dir" && find . -name '*.ts' ! -name '*.d.ts' | sed 's|^\./||'); do
            desugar "$dir/$f" "$MIRROR$dir/$f" 0 >/dev/null 2>&1 || :
        done
        ;;
    esac
    base=$(basename "$page")
    m="$MIRROR$dir/$base"
    if ! desugar "$dir/$base" "$m" 1; then
        echo "FAIL $page: the dialect refuses it: $(cat "$m")"
        fails=$((fails + 1))
        continue
    fi
    rel="${dir#/}"
    if out=$(cd "$MIRROR" && $TSC_CMD $TSC_FLAGS sae.d.ts "$rel/$base" 2>&1); then
        echo "ok   $page"
    else
        echo "FAIL $page"
        echo "$out" | sed "s|^$rel/|$(dirname "$page")/|" | sed 's/^/       /'
        fails=$((fails + 1))
    fi
done
exit $fails
