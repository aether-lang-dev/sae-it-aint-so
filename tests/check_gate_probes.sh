#!/bin/sh
# tests/check_gate_probes.sh — step 0 of docs/design/gate-dsl.md: what the
# Aether on this toolchain really does with the features the generated gate
# depends on. Small throwaway programs, each expected to be accepted or
# rejected; a rejection is checked against its diagnostic, not only the exit
# status. Nothing here touches src/ or target/; only `ae` is needed.
#
# FINDINGS (Aether 0.926.0, the pin; first taken on 0.923.0, same on macOS
# and Linux, see the design doc)
#
#   name used inside `seal except ...`          sealed?  what to list
#   ------------------------------------------  -------  -------------------
#   outer top-level function                    yes      its name  (E0301 "Undefined function")
#   `builtin` println                           yes      println   (E0301)
#   module prefix (fs.read, os.getenv)          yes      the module (E0304)
#   `string` module                             yes      `string` in backticks (bare: E0100, reserved)
#   import std.fs as files                      yes      the REAL name `fs`; `files` alone is E0304
#   top-level const                             yes      its name  (E0304)
#   a listed module's exported const (mm.K)     no       the module is enough (0.926.0; refused before)
#   enum name (Color.RED)                       yes      the enum  (E0304)
#   extern C function (putchar)                 yes      its name  (E0301)
#   struct name as parameter type (p: *T)       no       -
#   struct name in sizeof(T)                    no       -
#   struct name in `p as *T`                    yes      the struct (E0200 "'T' is not a struct type")
#   struct name in heap.new(T) / T{...}         yes      the struct (E0200 / E0304)
#   heap.new / heap.free themselves             no       -  (only T needs listing)
#   a field read of an unlisted struct          no       the value keeps its type (0.926.0; on
#                                                        0.923.0 the field silently lost it)
#   local variable, closure, "${}"              no       -
#   parameter of the function itself            no       - (0.926.0; through 0.923.0 E0304: each
#                                                        had to be listed). A seal on a nested
#                                                        block still needs them; `hide p` hides one
#   a function's locals in a closure passed     no       - (0.926.0; through 0.923.0 E0300 when
#     to another module's function                       the function was a module's)
#   `fs.member` with `seal except fs`           admitted: all of fs, not one member
#   `hide fs.read` / `import fs hiding (read)`  still bite under `seal except fs`; other fs.* stay
#   generated C                                 the same with and without the seal (0.926.0)
#   seal reaches through calls                  no: a listed helper may use anything (the
#                                               guarantee is the reviewed helper set)
#   seal not on the first line                  accepted; it covers the whole body, also
#                                               lines above it
#
#   DSL mechanics
#   a trailing block whose function has an `@keep fn` LAST parameter   REJECTED (E0200:
#       the block is taken to be the closure). Put the function before another parameter:
#       api(_ctx, name, f, arity) { ... }, not api(_ctx, name, arity, f) { ... }
#   `_ctx: ptr` two levels deep, outer call's returned pointer is the inner block's _ctx  works
#   storing or returning _ctx needs `_ctx: @keep ptr` (E0902 otherwise); reading it does not
#   top-level fn passed as `@keep fn` from inside a trailing block, called at once   works
#   `return v` inside a block: returns from the ENCLOSING function (not the block)
#   `;` separates statements on one line                                        works
#   fn value in a struct field, called later, via a list or a local           works
#   cost: see the timing probe at the end (microseconds per page-load equivalent)
#
# Part g holds what step 10 needs of seal except on sae's kind of function:
# the four fixes of Aether 0.926.0, each with what must still be refused.
#
# Exit status: the number of failed checks.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
fails=0

. "$ROOT/tools/aether_home.sh"
sae_aether_home_ "$ROOT"
if [ -n "${SAE_AETHER_HOME:-}" ]; then
    export AETHER_HOME="$SAE_AETHER_HOME"
    PATH="$SAE_AETHER_HOME/build:$PATH"
fi
PATH="$ROOT/target/toolchain/bin:$PATH"

work=$(mktemp -d "${TMPDIR:-/tmp}/sae-gate-probes.XXXXXX") || exit 1
trap 'rm -rf "$work"' EXIT

ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

# build <name>: compile $work/<name>.ae; log in $work/<name>.log.
build() { (cd "$work" && ae build "$1.ae" -o "$work/$1" >"$work/$1.log" 2>&1); }

# check <name> <accept|reject> <diagnostic pattern for reject>
check() {
    if build "$1"; then got=accept; else got=reject; fi
    if [ "$got" != "$2" ]; then
        bad "$1 should be ${2}ed, was ${got}ed ($(head -c 300 "$work/$1.log" | tr '\n' ' '))"
    elif [ "$2" = reject ] && ! grep -q -- "$3" "$work/$1.log"; then
        bad "$1 rejected, but not with '$3' ($(head -c 300 "$work/$1.log" | tr '\n' ' '))"
    else
        ok "$1 ${2}ed${3:+ ($3)}"
    fi
}

PRE='import std.fs
import std.string
import std.os
const K = 5
const NONE = 0
enum Color { RED, GREEN }
struct T { a: int }
extern putchar(c: int) -> int
helper(x: int) -> int { return x + 1 }'

# sealed <name> <accept|reject> <pattern> <seal list> <body>: body inside a
# top-level function whose first line is `seal except <list>` (`NONE`, a
# const the body never names, when the list is empty: a seal needs a name).
sealed() {
    {
        echo "$PRE"
        echo "f(p: ptr, n: int) -> int {"
        echo "    seal except ${4:-NONE}"
        printf '%s\n' "$5"
        echo "    return n"
        echo "}"
        echo 'main() { t = T{a: 1}  println(f(&t, 1)) }'
    } > "$work/$1.ae"
    check "$1" "$2" "$3"
}

# --- a. what seal blocks, and what must be listed ---
sealed s_base        accept ''      'println' '    x = n + 1
    println("${x}")'
sealed s_local_param accept ''      '' '    q = n + 1
    h = |x: int| { return x + q }
    _r = h(1)'
sealed s_param_unlisted accept ''  'helper' '    _x = helper(n)'
sealed s_param_listed accept ''    'p, n' '    _x = n'
sealed s_param_hidden reject E0304 '' '    hide n
    _x = n'
sealed s_param_nested reject E0304 '' '    if n > 0 {
        seal except println
        _x = n
    }'
sealed s_println     reject E0301   '' '    println("hi")'
sealed s_outerfn     reject E0301   '' '    _x = helper(n)'
sealed s_outerfn_ok  accept ''      'helper' '    _x = helper(n)'
sealed s_modprefix   reject E0304   '' '    _x = string.length("ab")'
sealed s_string_bare reject E0100   'string' '    _x = n'
sealed s_string_bt   accept ''      '`string`' '    _x = string.length("ab")'
sealed s_const       reject E0304   '' '    _x = K'
sealed s_const_ok    accept ''      'K' '    _x = K'
sealed s_enum        reject E0304   '' '    _x = Color.RED'
sealed s_enum_ok     accept ''      'Color' '    _x = Color.RED'
sealed s_extern      reject E0301   '' '    _x = putchar(65)'
sealed s_extern_ok   accept ''      'putchar' '    _x = putchar(65)'
sealed s_cast        reject E0200   '' '    q = p as *T
    _x = q.a'
sealed s_cast_ok     accept ''      'T' '    q = p as *T
    _x = q.a'
sealed s_sizeof      accept ''      '' '    _x = sizeof(T)'
sealed s_heapnew     reject E0200   'heap' '    e = heap.new(T)
    heap.free(e)'
sealed s_heapnew_ok  accept ''      'T' '    e = heap.new(T)
    heap.free(e)'
sealed s_structlit   reject E0304   '' '    _e = T{a: 2}'
sealed s_structlit_ok accept ''     'T' '    _e = T{a: 2}'
sealed s_not_first   accept ''      'fs' '    _x = n
    seal except fs
    _y = fs.exists("/")'
cat > "$work/s_above_seal.ae" <<EOP
$PRE
f(n: int) -> int {
    _y = helper(n)
    seal except K
    return n
}
main() { println(f(1)) }
EOP
check s_above_seal reject E0301
{   # a struct name only as a parameter type
    echo "$PRE"
    echo 'g(p: *T, n: int) -> int {
    seal except K
    return p.a + n
}
main() { t = T{a: 1}  println(g(&t, 1)) }'
} > "$work/s_param_type.ae"
check s_param_type accept ''

# --- b. a module in the list; hide and hiding with seal ---
sealed m_fs          accept ''      'p, n, fs' '    _c, _e = fs.read("/etc/hosts")
    _x = fs.exists("/")'
sealed m_fs_no       reject E0304   'p, n' '    _c, _e = fs.read("/etc/hosts")'
sealed m_os_no       reject E0304   'p, n, fs' '    _x = os.getenv("HOME")'
sealed m_hide_member reject E0304   'p, n, fs' '    hide fs.read
    _c, _e = fs.read("/etc/hosts")'
sealed m_hide_other  accept ''      'p, n, fs' '    hide fs.read
    _x = fs.exists("/")'
for k in read:reject:E0304 exists:accept:''; do
    fn=${k%%:*}; rest=${k#*:}; want=${rest%%:*}; pat=${rest#*:}
    {
        echo 'import std.fs hiding (read)'
        echo 'f(p: ptr, n: int) -> int {
    seal except p, n, fs'
        [ "$fn" = read ] && echo '    _c, _e = fs.read("/etc/hosts")' || echo '    _x = fs.exists("/")'
        echo '    return n
}
main() { println(f(null, 1)) }'
    } > "$work/m_hiding_$fn.ae"
    check "m_hiding_$fn" "$want" "${pat:-}"
done
for k in files:reject fs:accept; do
    listed=${k%%:*}; want=${k#*:}
    {
        echo 'import std.fs as files
f(p: ptr, n: int) -> int {'
        echo "    seal except p, n, $listed"
        echo '    _x = files.exists("/")
    return n
}
main() { println(f(null, 1)) }'
    } > "$work/m_alias_$listed.ae"
    check "m_alias_$listed" "$want" "$( [ $want = reject ] && echo E0304 )"
done

# --- c. seal does not reach through calls ---
cat > "$work/c_transitive.ae" <<'EOP'
import std.fs
const K = 5
helper(n: int) -> int {
    _e = fs.exists("/")
    return n + K
}
f(n: int) -> int {
    seal except n, helper
    return helper(n)
}
main() { println(f(1)) }
EOP
check c_transitive accept ''
[ "$("$work/c_transitive")" = 6 ] && ok "c_transitive runs" || bad "c_transitive output"

# --- d. the DSL mechanics ---
DSL_HEAD='struct Gate { mode: int }
struct Space { id: int }
struct Entry { id: int }
struct Page { v: int }
hostfn(p: *Page, a: int, b: int) -> int { return p.v + a + b }
space(_ctx: ptr, g: *Gate, name: string) -> ptr {
    s = heap.new(Space)
    s.id = 7
    return s
}
arg(_ctx: ptr, name: string) {
    e = _ctx as *Entry
    println("arg ${name} entry=${e.id}")
}'
# d1: f is the last parameter: the block is taken for the closure.
cat > "$work/d_fn_last.ae" <<EOP
$DSL_HEAD
api(_ctx: ptr, name: string, arity: int, f: @keep fn(*Page, int, int) -> int) -> ptr {
    return null
}
main() { g = Gate{mode: 0}  space(&g, "ui") { api("x", 2, hostfn) { arg("a") } } }
EOP
check d_fn_last reject E0200
# d2: f before another parameter; the outer pointer is the inner _ctx; ';'.
cat > "$work/d_two_levels.ae" <<EOP
$DSL_HEAD
api(_ctx: @keep ptr, name: string, f: @keep fn(*Page, int, int) -> int, arity: int) -> ptr {
    s = _ctx as *Space
    e = heap.new(Entry)
    e.id = s.id * 100 + arity
    pg = Page{v: 10}
    println("api \${name} \${f(&pg, 1, 2)}")
    return e
}
gate_spec(g: *Gate) {
    space(g, "ui") {
        api("x", hostfn, 2) { arg("a"); arg("b") }
        api("y", hostfn, 3) { arg("z") }
    }
}
early(g: *Gate) -> int {
    space(g, "ui") {
        api("x", hostfn, 2) {
            if g.mode == 1 { return 42 }
            arg("after")
        }
    }
    println("after blocks")
    return 7
}
main() {
    g = Gate{mode: 0}
    gate_spec(&g)
    g.mode = 1
    println("early \${early(&g)}")
}
EOP
check d_two_levels accept ''
want='api x 13
arg a entry=702
arg b entry=702
api y 13
arg z entry=703
api x 13
early 42'
[ "$("$work/d_two_levels")" = "$want" ] \
    && ok "d_two_levels: _ctx two levels deep, fn kept, ';' separates, return leaves the enclosing function" \
    || bad "d_two_levels output: $("$work/d_two_levels" | tr '\n' '|')"
# d3: storing a _ctx needs @keep.
cat > "$work/d_ctx_store.ae" <<EOP
$DSL_HEAD
struct Holder { s: *Space }
keep(_ctx: ptr, h: *Holder) { h.s = _ctx as *Space }
main() { }
EOP
check d_ctx_store reject E0902

# --- e. function values in a struct field ---
cat > "$work/e_fn_field.ae" <<'EOP'
struct Page { v: int }
struct Ent { name: string, f: fn(*Page, int, int) -> int, arity: int }
hostfn(p: *Page, a: int, b: int) -> int { return p.v + a + b }
other(p: *Page, a: int, b: int) -> int { return 100 + a }
main() {
    ents = [Ent{name: "x", f: hostfn, arity: 2}, Ent{name: "y", f: other, arity: 2}]
    pg = Page{v: 10}
    total = 0
    i = 0
    while i < 2 {
        e = ents[i]
        total = total + e.f(&pg, 1, 2)
        i = i + 1
    }
    f = ents[0].f
    println("${total} ${f(&pg, 1, 2)}")
}
EOP
check e_fn_field accept ''
[ "$("$work/e_fn_field")" = "114 13" ] && ok "e_fn_field runs" || bad "e_fn_field output"

# --- f. timing: 300 api-like calls, 3 no-op setters each, per page load ---
{
    cat <<'EOP'
import std.os
struct Page { v: int }
struct Gate { n: int }
struct Entry { g: *Gate, arity: int, f: fn(*Page, int, int) -> int }
hostfn(p: *Page, a: int, b: int) -> int { return p.v + a + b }
space(_ctx: ptr, g: *Gate, name: string) -> ptr { return g }
api(_ctx: @keep ptr, name: string, f: @keep fn(*Page, int, int) -> int, arity: int) -> ptr {
    g = _ctx as *Gate
    g.n = g.n + 1
    e = heap.new(Entry)
    e.g = g
    e.arity = arity
    e.f = f
    return e
}
arg(_ctx: ptr, name: string, t: int) { }
doc(_ctx: ptr, text: string) { }
gives(_ctx: ptr, t: int) { }
spec(g: *Gate) {
    space(g, "ui") {
EOP
    i=1
    while [ $i -le 300 ]; do
        printf '        api("n%d", hostfn, 2) { arg("a", 1)\n            gives(2)\n            doc("d") }\n' $i
        i=$((i + 1))
    done
    cat <<'EOP'
    }
}
main() {
    g = Gate{n: 0}
    iters = 2000
    t0 = os.now_monotonic_ns()
    i = 0
    while i < iters { spec(&g)  i = i + 1 }
    println((os.now_monotonic_ns() - t0) / iters / 1000)
}
EOP
} > "$work/f_timing.ae"
if build f_timing; then
    us=$("$work/f_timing")
    echo "info f_timing: ${us} us per page load for 300 entries x 3 setters (allocating one entry each)"
    # Generous bound: the design needs this to be small next to a page load.
    [ "${us:-99999}" -lt 2000 ] && ok "f_timing under 2000 us" || bad "f_timing ${us} us is not small"
else
    bad "f_timing did not build ($(head -c 300 "$work/f_timing.log" | tr '\n' ' '))"
fi

# --- g. step 10, what `seal except` does to sae's own kind of function ---
# Aether 0.923.0 stopped step 10 on three faults (docs/design/gate-dsl.md,
# "Step 10"); 0.926.0 fixes them and admits a function's own parameters. Each
# probe holds one fix, beside what the seal must still refuse.
mkdir -p "$work/mm"
cat > "$work/mm/module.ae" <<'EOP'
exports (run_it, K, bump)
const K = 7
run_it(f: @keep fn) { f() }
bump(x: int) -> int { return x + K }
EOP
# A: a closure passed straight to a MODULE function sees the sealed
# function's own locals, as one passed to a function of the file does; an
# unlisted top-level function stays refused inside it.
gclosure() {   # gclosure <name> <run_it spelling> <seal list>
    {
        [ "$2" = mm.run_it ] && echo 'import mm' || echo 'run_it(f: @keep fn) { f() }'
        echo 'helper(x: int) -> int { return x + 1 }'
        echo 'f1(p: int, argv: int) -> int {'
        echo "    seal except $3"
        echo '    ctx = p + 1
    seq = argv
    out = 0
    '"$2"'(|| {
        out = helper(ctx + seq)
    })
    return out
}
main() { println(f1(1, 2)) }'
    } > "$work/$1.ae"
}
# p and argv are listed (allowed, and a no-op on 0.926.0) so that these hold
# fault A alone.
gclosure g_closure_local run_it 'p, argv, run_it, helper'
gclosure g_closure_module mm.run_it 'p, argv, mm, helper'
gclosure g_closure_module_unlisted mm.run_it 'p, argv, mm'
check g_closure_local accept ''
check g_closure_module accept ''
[ "$("$work/g_closure_module" 2>&1)" = "$("$work/g_closure_local" 2>&1)" ] \
    && ok "g_closure_module runs as g_closure_local does ($("$work/g_closure_module" 2>&1))" \
    || bad "g_closure_module printed '$("$work/g_closure_module" 2>&1)', g_closure_local '$("$work/g_closure_local" 2>&1)'"
check g_closure_module_unlisted reject "E0301.*helper"
# B: a listed module's exported const is admitted with the module; without
# the module neither is.
cat > "$work/g_module_const.ae" <<'EOP'
import mm
f1(p: int) -> int {
    seal except p, mm
    a = mm.K
    return a + mm.bump(p)
}
main() { println(f1(1)) }
EOP
sed 's/seal except p, mm/seal except p, println/' "$work/g_module_const.ae" > "$work/g_module_const_unlisted.ae"
export AETHER_LIB_DIR="$work"
check g_module_const accept ''
[ "$("$work/g_module_const")" = 15 ] && ok "g_module_const runs (15)" || bad "g_module_const printed '$("$work/g_module_const")'"
check g_module_const_unlisted reject "E0304.*mm"
# C: a struct not on the list keeps its field types: the string field is
# compared as a string under the seal too, and the generated C of a sealed
# body is the C of the same body unsealed (aetherc, `#line` lines left out).
# Naming the struct itself (heap.new) still needs it listed.
cat > "$work/g_field_type.ae" <<'EOP'
struct T { name: string }
new_t() -> *T {
    t = heap.new(T)
    t.name = "abc"
    return t
}
f1(p: int) -> int {
    seal except new_t
    t = new_t()
    s = "ab"
    if t.name == "${s}c" { return 1 }
    return 0
}
f2(p: int) -> int {
    seal except new_t, T
    t = new_t()
    s = "ab"
    if t.name == "${s}c" { return 1 }
    return 0
}
main() { println("${f1(0)}${f2(0)}") }
EOP
check g_field_type accept ''
got=$("$work/g_field_type")
[ "$got" = 11 ] && ok "g_field_type: a string field of an unlisted struct compares as a string ($got)" \
    || bad "g_field_type printed '$got' (01: the unlisted struct lost its field types, the 0.923.0 fault)"
sed 's/^    seal except .*$/    _sealed_line = 0/' "$work/g_field_type.ae" > "$work/g_field_plain.ae"
gen_c() { (cd "$work" && aetherc "$1.ae" "$1.c" >"$1.clog" 2>&1) && grep -v '^#line' "$work/$1.c" | sed 's/g_field_plain/g_field_type/g' > "$work/$1.cn"; }
if gen_c g_field_type && gen_c g_field_plain; then
    # The plain twin has `_sealed_line = 0` where the seal was: drop that one
    # statement's C before comparing.
    grep -v '_sealed_line' "$work/g_field_plain.cn" > "$work/g_field_plain.cm"
    grep -v '_sealed_line' "$work/g_field_type.cn" > "$work/g_field_type.cm"
    if cmp -s "$work/g_field_plain.cm" "$work/g_field_type.cm"; then
        ok "g_field_type: the generated C with the seals is the C without them"
    else
        bad "g_field_type: the generated C differs with the seals ($(diff "$work/g_field_plain.cm" "$work/g_field_type.cm" | head -6 | tr '\n' ' '))"
    fi
else
    bad "g_field_type/g_field_plain: aetherc failed ($(cat "$work/g_field_type.clog" "$work/g_field_plain.clog" | head -c 300 | tr '\n' ' '))"
fi
sed 's/seal except new_t, T/seal except new_t/; s/t = new_t()$/t = heap.new(T)/' "$work/g_field_type.ae" > "$work/g_struct_named.ae"
check g_struct_named reject "E0200.*T"
# D: the body's own parameters (here p and argv) need no listing; that is
# s_param_unlisted, s_param_hidden and s_param_nested in part a.
unset AETHER_LIB_DIR

exit $fails
