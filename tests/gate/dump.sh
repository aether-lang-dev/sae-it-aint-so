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
#   just-<priv> an app that grants everything and seeks only <priv>, one of
#               local-filesystem outgoing-http open-urls print documents
#               clipboard clipboard-read control-bus backend: which space each
#               privilege unlocks, so a seek spelled wrong, or taken from the
#               wrong line, shows
#   just-database  an app with a sqlite database, notes, that seeks it
#   just-native    an app with a native module, calc, that seeks it, run on the
#               app's own sae (tools/saehost.sh builds it, here, when it is
#               missing or older than the sources)
#   probe       a page from a file, with the sandbox probe switched on
#   module      a page from a file that imports a module (it has $sae)
# Used by tests/check_gate.sh.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SAE=${SAE:-$ROOT/target/build/bin/sae}
mode=${1:?mode}
W="$ROOT/target/gate/$mode"
rm -rf "$W" && mkdir -p "$W"
export SAE_NO_WINDOW=1
SEEKS_ALL="local-filesystem outgoing-http open-urls print documents clipboard clipboard-read control-bus backend"

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
    "backend": { "program": "no-such-backend" },
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
probe)
    mkdir -p "$W/canary"
    cp "$ROOT/tests/gate/dump.ts" "$W/dump.ts"
    cd "$W" && SAE_SANDBOX_PROBE="$W/canary" AETHER_UI_TEST_PORT=1 exec "$SAE" dump.ts ;;
module)
    { echo 'import "./gatemod.ts";'; cat "$ROOT/tests/gate/dump.ts"; } > "$W/dump.ts"
    echo 'export const gatemod = 1;' > "$W/gatemod.ts"
    cd "$W" && exec "$SAE" dump.ts ;;
just-database)
    index_seeking "$W/index.ts" "" "database notes"
    mkdir -p "$W/db"
    echo 'create table notes (id integer primary key, body text);' > "$W/db/001_init.sql"
    echo '{ "name": "Gate dump (a database)", "capabilities": { "sqlite": { "notes": { "migrations": ["db/001_init.sql"] } } } }' > "$W/app.json"
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" ;;
just-native)
    host=${SAE_NATIVES_HOST:-$ROOT/target/hosts/natives_demo/target/build/bin/sae}
    if [ -z "${SAE_NATIVES_HOST:-}" ]; then
        # the app's own sae, built from this tree: again when a source is newer
        if [ ! -x "$host" ] || [ -n "$(find "$ROOT/src" "$ROOT/services" "$ROOT/natives" "$ROOT/aevg" -name '*.ae' -newer "$host" -print -quit)" ]; then
            "$ROOT/tools/saehost.sh" "$ROOT/tests/apps/natives" > "$ROOT/target/gate/natives-host.log" 2>&1 || { echo "dump.sh: tools/saehost.sh failed (target/gate/natives-host.log)" >&2; exit 1; }
        fi
    fi
    index_seeking "$W/index.ts" "" "native calc"
    mkdir -p "$W/native"
    cp "$ROOT/tests/apps/natives/native/calc.ae" "$W/native/calc.ae"
    cp "$ROOT/tests/apps/natives/app.json" "$W/app.json"
    SAE_APPDATA_DIR="$W/appdata" exec "$host" --app "$W" ;;
just-*)
    index_seeking "$W/index.ts" "" "${mode#just-}"
    grant_all
    SAE_APPDATA_DIR="$W/appdata" exec "$SAE" --app "$W" --control-bus ;;
*) echo "dump.sh: mode web, webseeks, all, some, unsought, optional, none, probe, module, just-database, just-native or just-<privilege>" >&2; exit 2 ;;
esac
