#!/bin/sh
# tests/gate/dump.sh <mode> -- run tests/gate/dump.ts headless and print its
# lines. The modes, which between them reach each side of a namespace's
# condition (WHEN_APP_OR_WEB_SEEKS, WHEN_APP_SEEKS in src/sae_host.ae):
#   web         a page loaded from a file (the browser's mode), seeking nothing
#   webseeks    a page loaded from a file that seeks outgoing-http and clipboard
#   all         an app that grants and seeks every privilege
#   some        an app that grants everything and seeks outgoing-http, clipboard
#   unsought    an app that grants everything and seeks nothing
#   optional    an app that grants nothing and seeks everything, as optional
#   none        an app that grants nothing and seeks nothing
# Used by tests/check_gate.sh.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SAE=${SAE:-$ROOT/target/build/bin/sae}
mode=${1:?mode}
W="$ROOT/target/gate/$mode"
rm -rf "$W" && mkdir -p "$W"
export SAE_NO_WINDOW=1
SEEKS_ALL="local-filesystem outgoing-http open-urls print documents clipboard clipboard-read control-bus"

# The app.json that grants every privilege.
grant_all() {
    cat > "$W/app.json" <<'JSON'
{
  "name": "Gate dump (everything granted)",
  "capabilities": {
    "http": ["http://127.0.0.1:8091/api/"],
    "shell": { "open": ["https://example.com/"] },
    "fs": { "write": ["$APPDATA/"] },
    "documents": {},
    "print": {},
    "controlBus": { "name": "gatedump" },
    "clipboard": ["write", "read"]
  }
}
JSON
}

# A page: a "seeks" line for each privilege after the first two arguments
# (the second a suffix for each line, as ", reduced functionality without"),
# then the dump.
index_seeking() {   # index_seeking <out> <suffix> <privileges...>
    out=$1; sfx=$2; shift 2
    {
        for s in "$@"; do echo "\"seeks $s$sfx\";"; done
        cat "$ROOT/tests/gate/dump.ts"
    } > "$out"
}

case "$mode" in
web)
    cp "$ROOT/tests/gate/dump.ts" "$W/dump.ts"
    cd "$W" && exec "$SAE" dump.ts ;;
webseeks)
    index_seeking "$W/dump.ts" "" outgoing-http clipboard
    cd "$W" && exec "$SAE" dump.ts ;;
all)
    index_seeking "$W/index.ts" "" $SEEKS_ALL
    grant_all
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" --control-bus ;;
some)
    index_seeking "$W/index.ts" "" outgoing-http clipboard
    grant_all
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" --control-bus ;;
unsought)
    cp "$ROOT/tests/gate/dump.ts" "$W/index.ts"
    grant_all
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" --control-bus ;;
optional)
    index_seeking "$W/index.ts" ", reduced functionality without" $SEEKS_ALL
    echo '{ "name": "Gate dump (nothing granted)" }' > "$W/app.json"
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" ;;
none)
    cp "$ROOT/tests/gate/dump.ts" "$W/index.ts"
    echo '{ "name": "Gate dump (nothing)" }' > "$W/app.json"
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" ;;
*) echo "dump.sh: mode web, webseeks, all, some, unsought, optional or none" >&2; exit 2 ;;
esac
