#!/bin/sh
# needs.sh APP_DIR SAE_ROOT: the sibling checkouts an app's backend is built
# with (APP_DIR/backend/needs, one name a line, # comments) are beside sae,
# or it says which is missing and how to get it, and fails, before a build
# that would fail on an unresolved import.
f="$1/backend/needs"
[ -f "$f" ] || exit 0
missing=0
for n in $(grep -v '^#' "$f"); do
    if [ ! -d "$2/../$n" ]; then
        echo "needs.sh: $1 needs a $n checkout beside sae, at $2/../$n (git clone https://github.com/aether-lang-dev/$n.git); not built, its spec not run" >&2
        missing=1
    fi
done
exit $missing
