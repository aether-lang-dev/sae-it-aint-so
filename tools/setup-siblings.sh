#!/bin/sh
# tools/setup-siblings.sh — bring in the sibling checkouts sae builds from,
# for a machine that has only sae (a Claude Code cloud session, a fresh CI
# box): ../aether, ../aether-ui and ../aeb.
#
#   tools/setup-siblings.sh            clone and build whatever is missing
#   tools/setup-siblings.sh --hook     the SessionStart hook (.claude/settings.json):
#                                      only in a Claude Code cloud session
#                                      (CLAUDE_CODE_REMOTE=true), and a
#                                      failure is reported, never fatal
#
# For each sibling that does not exist, a shallow clone at the ref in ./pins
# (aether at tag v$AE_PIN, aether-ui at commit $AETHER_UI_REF, aeb at tag
# $AEB_REF), then the build sae needs:
#
#   aether     make compiler ae stdlib contrib, and the QuickJS amalgamation
#              (scripts/fetch-quickjs-amalgamation.sh); the Aether dev tree
#              ./build.sh then compiles against
#   aeb        make install PREFIX=target/toolchain, with ../aether/build's
#              `ae` on PATH (aeb's install runs ae)
#   aether-ui  nothing to build: sae compiles its backend/ itself
#
# A sibling that already exists is never touched: not fetched, not checked
# out, not built (it may be your working copy, at whatever commit you are
# working on). With all three present the script is a no-op that runs no
# git and no network, so it is safe as a hook on a workstation.
#
# A clone this script made is marked in its .git (sae-setup holds "cloned",
# then "built"), so an interrupted build is resumed next time rather than
# mistaken for a working copy. Nothing else carries that mark.
#
# Not done here: system packages. On Linux the GTK4 browser build needs
# libgtk-4-dev and libepoxy-dev (README "Build and run"); this only says so.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PARENT=$(cd "$ROOT/.." && pwd)
QUIET=${SAE_SETUP_QUIET:-0}
if [ "${1:-}" = --hook ]; then
    # A local session (Paul's Mac, any workstation) returns here, before
    # looking at anything: the siblings there are working copies.
    [ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0
    # Never fail the session over this; say what broke instead.
    SAE_SETUP_QUIET=1 sh "$0" || echo "sae setup-siblings: failed (see above); the session continues without the siblings"
    exit 0
fi

say() { echo "sae setup-siblings: $*"; }
note() { [ "$QUIET" = 1 ] || say "$@"; }

# The mark: "" (not ours, or absent), "cloned" or "built".
mark_of() { cat "$PARENT/$1/.git/sae-setup" 2>/dev/null || true; }
set_mark() { echo "$2" >"$PARENT/$1/.git/sae-setup"; }

# Which siblings need work: missing, or ours and not yet built.
todo=""
for s in aether aether-ui aeb; do
    if [ ! -e "$PARENT/$s" ] || [ "$(mark_of "$s")" = cloned ]; then
        todo="$todo $s"
    fi
done
if [ -z "$todo" ]; then
    note "../aether, ../aether-ui and ../aeb exist; nothing to do"
    exit 0
fi

. "$ROOT/pins"
AETHER_URL=${AETHER_URL:-https://github.com/aether-lang-dev/aether.git}
AEB_URL=${AEB_URL:-https://github.com/aether-lang-dev/aeb.git}
command -v git >/dev/null 2>&1 || { say "git is required"; exit 1; }
command -v make >/dev/null 2>&1 || { say "make is required"; exit 1; }
JOBS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)
LOGDIR="$ROOT/target/setup-siblings"
mkdir -p "$LOGDIR"

# clone NAME URL REF: a shallow clone of a tag or a commit. A commit is
# fetched by id (GitHub serves any reachable commit), a tag as a branch.
clone() {
    name=$1 url=$2 ref=$3 dir="$PARENT/$1"
    [ -e "$dir" ] && return 0
    say "cloning $url at $ref into ../$name"
    case "$ref" in
        [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
            git init -q "$dir"
            git -C "$dir" remote add origin "$url"
            git -C "$dir" fetch -q --depth 1 origin "$ref"
            git -C "$dir" -c advice.detachedHead=false checkout -q FETCH_HEAD ;;
        *)
            git -c advice.detachedHead=false clone -q --depth 1 --branch "$ref" "$url" "$dir" ;;
    esac
    set_mark "$name" cloned
}

# run_logged NAME LOG CMD...: run a build step, its output to a log, and
# show the log's tail if it fails.
run_logged() {
    what=$1 log=$2; shift 2
    say "$what (log: ${log#"$ROOT"/})"
    "$@" >"$log" 2>&1 || { tail -30 "$log" >&2; say "$what failed"; exit 1; }
}

for s in $todo; do
    case "$s" in
        aether)    clone aether "$AETHER_URL" "v$AE_PIN" ;;
        aether-ui) clone aether-ui "$AETHER_UI_URL" "$AETHER_UI_REF" ;;
        aeb)       clone aeb "$AEB_URL" "$AEB_REF" ;;
    esac
done

# sqlite_from_npm: when www.sqlite.org is out of reach (a Claude Code cloud
# session's network policy blocks it) and ../aether is a clone of ours, put
# the SQLite amalgamation that better-sqlite3's npm package carries where
# aether's fetch script would extract the pinned zip, and mark it with the
# pin's hash so the script keeps it. A stand-in for a dev container, not the
# pinned source: any recent SQLite serves, and nothing built from it ships.
# CLAUDECODE-CLOUD.md says more.
sqlite_from_npm() {
    amal="$PARENT/aether/contrib/sqlite/amalgamation"
    [ -f "$amal/sqlite3.c" ] && return 0
    . "$PARENT/aether/contrib/sqlite/amalgamation.lock"
    curl -fsI -m 20 "$SQLITE_URL" >/dev/null 2>&1 && return 0
    say "www.sqlite.org is unreachable; taking SQLite from npm's better-sqlite3 instead"
    tgz=$(curl -fsSL -m 60 https://registry.npmjs.org/better-sqlite3/latest |
        sed -n 's/.*"tarball":"\([^"]*\)".*/\1/p')
    [ -n "$tgz" ] || { say "the npm registry did not answer; no SQLite amalgamation"; return 0; }
    work=$(mktemp -d)
    if curl -fsSL -m 300 "$tgz" | tar xzf - -C "$work" package/deps/sqlite3; then
        mkdir -p "$amal"
        cp "$work"/package/deps/sqlite3/sqlite3.c "$work"/package/deps/sqlite3/sqlite3.h \
           "$work"/package/deps/sqlite3/sqlite3ext.h "$amal"/
        printf '%s\n' "$SQLITE_SHA256" >"$amal/.sha256"
        printf '%s\n' "$tgz (not $SQLITE_URL)" >"$amal/.source"
        say "SQLite $(sed -n 's/^#define SQLITE_VERSION *"\(.*\)"/\1/p' "$amal/sqlite3.h") from ${tgz##*/}"
    else
        say "could not unpack $tgz; no SQLite amalgamation"
    fi
    rm -rf "$work"
}

if [ "$(mark_of aether)" = cloned ]; then
    sqlite_from_npm
    run_logged "building aether $AE_PIN (compiler ae stdlib contrib)" "$LOGDIR/aether.log" \
        make -C "$PARENT/aether" -j"$JOBS" compiler ae stdlib contrib
    run_logged "fetching the QuickJS amalgamation into ../aether" "$LOGDIR/quickjs.log" \
        sh "$PARENT/aether/scripts/fetch-quickjs-amalgamation.sh"
    set_mark aether built
fi
if [ "$(mark_of aether-ui)" = cloned ]; then
    set_mark aether-ui built
fi
if [ "$(mark_of aeb)" = cloned ]; then
    [ -x "$PARENT/aether/build/ae" ] || {
        say "../aeb needs ../aether/build/ae to install, and ../aether is not built"
        exit 1
    }
    run_logged "installing aeb $AEB_REF into target/toolchain" "$LOGDIR/aeb.log" \
        env PATH="$PARENT/aether/build:$PATH" AETHER_HOME="$PARENT/aether" \
        make -C "$PARENT/aeb" install PREFIX="$ROOT/target/toolchain"
    set_mark aeb built
fi

if [ "$(uname -s)" = Linux ] && ! pkg-config --exists gtk4 epoxy 2>/dev/null; then
    say "the browser build (./build.sh) also needs libgtk-4-dev and libepoxy-dev;" \
        "lower/run-tests.sh, saelower and saejs do not"
fi
say "done; now ./build.sh"
