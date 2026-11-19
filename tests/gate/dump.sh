#!/bin/sh
# tests/gate/dump.sh <web|all|none> -- run tests/gate/dump.ts headless and
# print its lines. web: a page loaded from a file (the browser's
# mode); all: an app that grants and seeks every privilege; none: an app that
# grants nothing and seeks nothing. Used by tests/check_gate.sh.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SAE=${SAE:-$ROOT/target/build/bin/sae}
mode=${1:?mode}
W="$ROOT/target/gate/$mode"
rm -rf "$W" && mkdir -p "$W"
export SAE_NO_WINDOW=1
case "$mode" in
web)
    cp "$ROOT/tests/gate/dump.ts" "$W/dump.ts"
    cd "$W" && exec "$SAE" dump.ts ;;
all)
    {
        for s in local-filesystem outgoing-http open-urls print documents clipboard clipboard-read control-bus; do
            echo "\"seeks $s\";"
        done
        cat "$ROOT/tests/gate/dump.ts"
    } > "$W/index.ts"
    cat > "$W/app.json" <<'JSON'
{
  "name": "Gate dump (everything)",
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
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" --control-bus ;;
none)
    cp "$ROOT/tests/gate/dump.ts" "$W/index.ts"
    echo '{ "name": "Gate dump (nothing)" }' > "$W/app.json"
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" ;;
*) echo "dump.sh: mode web, all or none" >&2; exit 2 ;;
esac
