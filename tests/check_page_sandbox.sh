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

exit $fail
