#!/bin/sh
# tests/check_timed_entries.sh -- every way the host runs a page's JS is a
# timed entry. Page code runs not only in quickjs.eval, call and run_jobs but
# in any host conversion of a page's value: a getter (get, get_index, length,
# keys), a valueOf (to_int, to_float, to_bool), a toString (to_string), a
# toJSON (to_json), a setter (set, set_index, set_global). contrib.quickjs's
# deadline is absolute and sae clears it between entries, so a conversion
# made outside an entry (after a handler returned: a menu opened by a click,
# a datagrid cell's value read back) is unbounded unless it is one itself.
# src/sae_host.ae therefore calls js_eval_, js_call_, js_run_jobs_ and the
# js_get_, js_to_string_, ... helpers (which begin an entry unless one is
# running), never the quickjs.* they wrap: this fails on a raw call outside
# the helpers' block. (quickjs.arg_* read a host function's own arguments, and
# only a page's own call into a host function runs them: always inside an
# entry. parse_json, type_of, new_*, release and dup run no page code.)
ROOT=$(cd "$(dirname "$0")/.." && pwd)
F="$ROOT/src/sae_host.ae"
from=$(grep -n "^// An entry into the page's JS runs under a deadline of its own" "$F" | head -1 | cut -d: -f1)
to=$(grep -n "^engine_eval_(" "$F" | head -1 | cut -d: -f1)
[ -n "$from" ] && [ -n "$to" ] || { echo "FAIL: the helpers' block markers are gone from src/sae_host.ae"; exit 1; }
bad=$(awk -v from="$from" -v to="$to" '
    NR >= from && NR < to { next }
    /^[ \t]*\/\// { next }
    /quickjs\.(eval|eval_async|eval_module|call|run_jobs|get|get_index|set|set_index|length|keys|to_json|to_int|to_float|to_bool|to_string|get_global|set_global)\(/ { print FILENAME ":" NR ": " $0 }
' "$F")
if [ -n "$bad" ]; then
    echo "FAIL a raw quickjs call that can run page JS, outside a timed entry (use the js_* helper):"
    echo "$bad"
    exit 1
fi
echo "ok   every eval, call, conversion and property access of a page's value is a timed entry"
