#!/bin/sh
# tests/check_page_sandbox.sh -- the source rules the page-entry sandbox
# stands on (docs/design/page-entry-sandbox.md). Headless: it reads
# src/sae_host.ae. Each rule says what breaks if it is broken.
#
# 1. No entry reads the environment. An entry runs under the page's grants
#    (the sandbox refuses a getenv there as "unset"), and a getenv scans the
#    whole environment besides. So the functions that read it, and the
#    functions that call those, are a short list of start-up and page-creation
#    code, and the tests below name them.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
F="$ROOT/src/sae_host.ae"
fail=0

# enclosing(): "<function>" for each call of $1( outside a comment or a definition
callers() {
    awk -v N="$1" '
        /^[a-z_A-Z0-9]+\(/ { split($0, a, "("); fn = a[1] }
        /^[ \t]*\/\// { next }
        /^[a-z_A-Z0-9]+\(/ { next }
        index($0, N "(") { print fn }
    ' "$F" | sort -u | tr '\n' ' '
}

# expect NAME "allowed callers (space separated, sorted)"
expect() {
    got=$(callers "$1")
    want="$2 "
    [ "$2" = "" ] && want=""
    if [ "$got" = "$want" ]; then echo "ok   $1( is called only from: ${2:-nowhere}"
    else echo "FAIL $1( is called from: ${got:-nowhere} -- the list is: ${2:-nowhere}"; fail=1; fi
}

# Who reads the environment (env_ and os.getenv), and who calls those readers.
expect env_ "app_data_dir_ browser_new_ bus_ui_ clock_start_ control_gone_ esc_coarse_decide_ home_dir_ lib_dir_ page_time_ms_ read_capabilities_ sae_main storage_dir_ temp_dir_"
expect os.getenv "env_"
expect page_time_ms_ "browser_new_"
expect storage_dir_ "page_new_ sqlite_start_"
expect home_dir_ "app_data_dir_ read_capabilities_ storage_dir_"
expect temp_dir_ "read_capabilities_"
expect app_data_dir_ "read_capabilities_ sae_main"
expect clock_start_ "browser_new_"
expect esc_coarse_decide_ "page_new_"
expect lib_dir_ "sae_main"
[ $fail = 0 ] && echo "ok   no function an entry can reach reads the environment"

# 2. A kernel tick does not run while page JS does. A nested event loop
#    under a host call (a file chooser, a clipboard read, a modal) runs the
#    kernel's timers on the page's stack, under the page's grants; each tick
#    begins by returning while b.entry_depth is above 0, and so does the
#    navigation timer's closure. A tick added without the guard fails here.
for fn in bus_tick_ backend_tick_ sqlite_poll_ http_poll_ later_tick_; do
    first=$(awk -v N="$fn" '
        index($0, N "(") == 1 { inside = 1; next }
        inside && /^[ \t]*\/\// { next }
        inside && /^[ \t]*$/ { next }
        inside { print; exit }
    ' "$F")
    case "$first" in
        *"if b.entry_depth > 0 { return }"*) echo "ok   $fn begins with the entry guard" ;;
        *) echo "FAIL $fn does not begin with 'if b.entry_depth > 0 { return }' (first line: $first)"; fail=1 ;;
    esac
done
# every ui.timer / ui.on_frame the kernel arms: a tick function named above, or the
# one listed here (the navigation timer's closure checks the guard inline)
ticks=$(grep -n "ui\.timer(" "$F" | grep -v "^[0-9]*:[ \t]*//" | grep -v "bus_tick_(b)\|backend_tick_(b)\|sqlite_poll_(b)\|http_poll_(hb)\|later_tick_(b)\|b.nav_timer = ui.timer(1")
if [ -n "$ticks" ]; then echo "FAIL a kernel timer that is not one of the guarded ticks:"; echo "$ticks"; fail=1
else echo "ok   every kernel timer is a guarded tick"; fi
nav=$(grep -A3 "b.nav_timer = ui.timer(1" "$F" | grep -c "if b.entry_depth > 0 { return }")
[ "$nav" = 1 ] && echo "ok   the navigation timer waits for no entry to run" || { echo "FAIL the navigation timer does not check b.entry_depth"; fail=1; }

# 3. What a page asks of the system is done after its entry, by a tick, not
#    under its grants: the effect is called from later_tick_ alone, and the
#    page-API functions only check (refusal) and queue (later_add_).
expect shell.open "later_tick_"
expect printing.pdf "later_tick_"

# 4. The runtime's sandbox_push and sandbox_pop (sandbox.enter and leave are
#    not released; they replace the builtins when they are) are named in the
#    entry helpers and in the one pair that leaves the page's grants, and
#    nowhere else; and that pair is used only by the sae_fs_* page-API
#    functions, each around its one services/files call.
expect sandbox_push "enter_grants_ entry_begin_"
expect sandbox_pop "entry_end_ entry_stopped_ leave_grants_"
FSFNS="sae_fs_exists sae_fs_list sae_fs_mkdir sae_fs_read_base64 sae_fs_read_text sae_fs_remove sae_fs_write_base64 sae_fs_write_text"
expect leave_grants_ "$FSFNS"
expect enter_grants_ "$FSFNS"
nfiles=$(grep -c "files\.\(read_text\|write_text\|read_base64\|write_base64\|exists\|list_json\|mkdir\|remove\)(" "$F")
nleave=$(grep -c "^    leave_grants_(p)$" "$F")
if [ "$nfiles" = "$nleave" ]; then echo "ok   each of the $nfiles services/files calls follows a leave_grants_"
else echo "FAIL $nfiles services/files calls, $nleave leave_grants_ lines"; fail=1; fi
exit $fail
