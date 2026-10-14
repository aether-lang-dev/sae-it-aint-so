# Ask (aether): a captured string assigned in a closure, after an early return, does not compile

## Motivation

sae's `services/files` and `services/documents` run each file operation
inside `std.sandbox`'s `enforce` (aether/docs/containment-sandbox.md), and
take its result out through variables the block assigns:

```aether
read_text(raw: string) -> (string, string) {
    p, why = path(raw, 0, "fs.read_text")
    if why != "" { return "", why }
    t = ""
    err = ""
    sandbox.enforce(perms) callback {
        t, err = fs.read(p)
    }
    ...
}
```

The generated C does not compile (clang: `use of undeclared identifier 't'`).

## Repro (Aether 0.812.0, d6aa4cc1)

```aether
import std.fs
import std.string

run(code: fn) {
    call(code, null)
}

reader(p: string) -> (string, string) {
    if p == "" { return "", "no path" }
    t = ""
    run() callback {
        rt, _re = fs.read(p)
        t = rt
    }
    return t, ""
}

main() {
    a, _b = reader("/etc/hosts")
    println("read ${string.length(a)}")
}
```

`ae run` fails in the C compile:

```
t4.ae:13:53: error: use of undeclared identifier 't'
```

Without the early `return` on the first line of `reader` it compiles and
prints `read 213`. So does `sandbox.enforce` in place of `run`: the
closure is enough.

## What the C shows

`t` is captured, so it becomes a heap cell (`const char** t =
_aether_cell_new(...)`), declared where `t = ""` is. Its heap-string flag
(`int _heap_t`) is declared at the top of the function, and the early
return's cleanup frees it: `if (_heap_t) { aether_heap_str_free(t); ... }`,
emitted before `t` exists (and, after it, with `t` a `const char**`, not a
string).

## Workaround in sae

Declare what the block sets before any return (each such function says so
and links here).

## What would help

The early return's cleanup skipping a captured variable not yet declared
(or the cell's cleanup going with the cell, not the plain string's).
