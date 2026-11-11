# tools/aether_home.sh: sourced, not run. Which Aether sae builds and tests
# against, in one place (build.sh, tools/saehost.sh and the test scripts all
# call sae_aether_home_ "$ROOT").
#
#   SAE_AETHER_HOME=<dir>   that Aether dev tree
#   SAE_AETHER_HOME=none    the ae on PATH
#   unset                   an Aether dev tree beside sae (../aether, built:
#                           build/libaether.a), but only when its VERSION is
#                           at least AE_PIN in pins. A checkout that lags the
#                           pin is skipped with a note on stderr, and the ae
#                           on PATH is used, rather than built against
#                           silently (2026-11-11: a 0.878.0 checkout failed
#                           five specs that need 0.908.0's os.run_stdio).
#
# On return SAE_AETHER_HOME is the chosen tree, or unset for the ae on PATH.

# 0 when dotted version $1 >= $2.
sae_version_ge_() {
    _sah_a=$1 _sah_b=$2
    while [ -n "$_sah_a$_sah_b" ]; do
        _sah_x=${_sah_a%%.*} _sah_y=${_sah_b%%.*}
        if [ "$_sah_a" = "$_sah_x" ]; then _sah_a=; else _sah_a=${_sah_a#*.}; fi
        if [ "$_sah_b" = "$_sah_y" ]; then _sah_b=; else _sah_b=${_sah_b#*.}; fi
        _sah_x=${_sah_x:-0} _sah_y=${_sah_y:-0}
        [ "$_sah_x" -gt "$_sah_y" ] && return 0
        [ "$_sah_x" -lt "$_sah_y" ] && return 1
    done
    return 0
}

sae_aether_home_() {
    if [ "${SAE_AETHER_HOME:-}" = none ]; then
        unset SAE_AETHER_HOME
        return 0
    fi
    [ -n "${SAE_AETHER_HOME:-}" ] && return 0
    _sah_sib=$1/../aether
    [ -f "$_sah_sib/build/libaether.a" ] || return 0
    _sah_pin=$(sed -n 's/^AE_PIN=//p' "$1/pins" 2>/dev/null)
    _sah_have=$(tr -d ' \r\n' < "$_sah_sib/VERSION" 2>/dev/null)
    if [ -n "$_sah_pin" ] && ! sae_version_ge_ "${_sah_have:-0}" "$_sah_pin"; then
        if [ -z "${SAE_AETHER_SKIP_NOTED:-}" ]; then
            echo "sae: not using ../aether (${_sah_have:-no VERSION}, below AE_PIN $_sah_pin); using the ae on PATH. SAE_AETHER_HOME=<dir> forces a tree." >&2
            SAE_AETHER_SKIP_NOTED=1
            export SAE_AETHER_SKIP_NOTED
        fi
        return 0
    fi
    SAE_AETHER_HOME=$(cd "$_sah_sib" && pwd)
}
