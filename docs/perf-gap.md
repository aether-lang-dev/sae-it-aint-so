# The engine gap: mquickjs-ae against Bellard's C

sae runs every page on mquickjs-ae, the Aether port of Fabrice Bellard and
Charlie Gordon's MicroQuickJS. The first spike (`spike-results.md`) found the
port about 9× slower than the C original on page logic. This is what that gap
was made of, what closed most of it, and what is left. Measured 2026-10-03.

For layout pages none of this matters: a native widget costs ~100 µs and the
JS that asks for it under 1 µs (`spike-results.md`). It matters for a page
that computes before it lays out.

## Where it stands

Octane scores and the mquickjs microbench, port against upstream C `7ea5399`,
both built `-Os` (upstream's default), macOS arm64:

| Step | Where | Octane, port score as a fraction of C | Microbench, port slower than C by |
|---|---|---|---|
| Start | mquickjs-ae `b9f88c4`, Aether 0.760 | 0.15 | 7.25× |
| Opcode `switch`, lazy scratch buffer | mquickjs-ae `d5c47c3` | 0.15 | 7.19× |
| Inline `mem` casts, cheap deadline check | Aether 0.763 ([#2375](https://github.com/aether-lang-dev/aether/pull/2375)) | 0.35 | 3.40× |
| Scratch on the stack, not `malloc` | mquickjs-ae `6652ee3` | 0.44 | 2.71× |
| Hot loop never tests `block` | mquickjs-ae `0a23dd1` | 0.51 | 2.10× |
| Unchecked memory accessors in the VM | Aether 0.766 ([#2382](https://github.com/aether-lang-dev/aether/pull/2382)), mquickjs-ae `a6f5fb5` | **0.59** | **1.70×** |

From about 6.7× slower to about 1.7× slower. Two page-shaped loops tell the same
story:

| Workload | Start | Now | C |
|---|---|---|---|
| build, sort and sum 20,000 records, ×40 | 3.28 s | 0.67 s | 0.31 s |
| `s = (s + i) \| 0` for 2×10⁸ iterations | 12.7 s | 4.5 s | 3.1 s |

`-O2` changes nothing for the port (0–2%) and gives C 7–8%, so the comparison
above is fair as it stands. (An earlier note here blamed part of the gap on
C being built `-O2`. It wasn't: upstream's Makefile defaults to
`CONFIG_SMALL=y`, which means `-Os`.)

## What the gap was made of

None of it was what it first looked like. Each step below came from a
profile, and two plausible guesses were measured and dropped.

**Not opcode dispatch, at first.** The port dispatched opcodes through a chain
of 111 `if opcode == X` tests. Turning it into a `switch` gained ~2%: clang had
already been compiling the chain into a jump table.

**Out-of-line calls into libaether (~30% of samples).** The VM reads its heap
through `mem.long_to_ptr`, `mem.ptr_to_long` and `mem.get_ptr`, and each was a
real call into `libaether.a`, which nothing can inline across. Aether already
inlined the other accessors (#1733); [#2375](https://github.com/aether-lang-dev/aether/pull/2375)
added these.

**A deadline check at every loop head (~22%).** Code compiled `--emit=lib`, as
the whole engine is, called `aether_caps_deadline_tripped()` at the top of
every loop. That reads two thread-locals, and on macOS each of those reads is
itself a call. #2375 puts a plain global in front, so unarmed code pays one
load.

**`malloc` for temporary storage (26–43% on numeric code).** Where C passes
the address of a local (`double d; JS_ToNumber(ctx, &d, v)`), the port
allocated: `pd = malloc(8) ... free(pd)`, at 256 sites. macOS's allocator also
reads the clock on each call, so a number conversion cost two allocator
calls and two clock reads. These are now stack arrays, as in C.

**Testing `block` on every instruction (~19%).** Aether has no `goto`, so the
port emulates the C's jumps to shared slow paths (exceptions, calls, slow
arithmetic) with a `block` state variable checked at the top of the loop.
Clang folded that check into one compare tree over all the block values,
0 included, so every fast opcode paid about seven compares. The VM is now two
loops: fast handlers go straight back to dispatch, and only a handler that
needs a slow path leaves for the outer loop.

**A null test on every memory access (~34% of the integer loop).** The VM
reads its stack, frames and bytecode through `mem.get_long` and friends, and
each kept the library's `if (!p) return 0` in front of the load, though every
pointer the VM reads through is non-null by construction. Aether 0.766 added
`_unchecked` accessors ([#2382](https://github.com/aether-lang-dev/aether/pull/2382)),
which `vm.ae` now uses throughout. (The checks were the second item filed as
[aether#2379](https://github.com/aether-lang-dev/aether/issues/2379); they
turned out far bigger than the "few percent" the issue guessed.)

**Ruled out:**

- *Storing the frame's pc on every instruction.* Removing the store changed
  nothing measurable.
- *Strict aliasing.* An Octane crash during this work looked like
  type-based alias reordering of the newly inlined accessors. Building with
  `-fno-strict-aliasing` crashed just as often. It was a real GC bug in the
  port, below.

## A bug found on the way

`js_parse_local_functions` didn't keep the child function rooted while it
was being parsed. Upstream wraps that parse in `JS_PUSH_VALUE` /
`JS_POP_VALUE`; the port had the comment but not the code. A compacting GC
mid-parse then left a stale function on the parser stack, and
`compute_stack_size` read a null bytecode pointer. It showed as intermittent
full-Octane segfaults, and every time with Octane's CodeLoad under a 32M
heap. It was present before any of the performance work. Fixed in mquickjs-ae
`192f984`, with a gate test that crashes on the old code.

## What is left

The port is now about 1.7× slower than C. What separates them is mostly how
the interpreter loop can be written:

- **Computed goto.** Bellard's VM ends each opcode handler with
  `goto *dispatch_table[*pc++]`: no loop head, and one indirect branch per
  handler, which predicts better than a single shared one. Aether can't
  express that, so the port has a loop and a `switch`. Proposed as
  [aether#2378](https://github.com/aether-lang-dev/aether/issues/2378), with
  plain `switch` as the fallback wherever the C compiler lacks computed goto.
- **The checked accessors outside the VM.** The tag, string and property
  modules the opcode handlers call still use the checked forms. Moving the
  hot ones over is mquickjs-ae work, not an Aether change.

Computed goto is an Aether change. Nothing in sae's design depends on it,
and sae gets it by moving to a newer Aether.

## How it was measured

- **Machine:** Mac mini, Apple Silicon, macOS 27.
- **Aether:** 0.763.0, then 0.766.0, built from source before each was on
  GitHub releases.
- **Builds:** mquickjs-ae built with aeb; upstream with its own Makefile
  (`make mqjs` for `-Os`, `make CONFIG_SMALL= mqjs` for `-O2`).
- **Benchmarks:** mquickjs-ae `scripts/bench.sh --octane`, and each binary
  run directly on `tests/microbench.js` and Octane's `run.js`
  (`--memory-limit 256M`). Loop timings are the best of three.
- **Function-level profiles:** `sample <pid> 2`.
- **Instruction-level profiles:**
  `xctrace record --template 'Time Profiler' --launch -- mqjs page.js`, then
  `xctrace export` of the `time-profile` table. Each sample's leaf address,
  less the ASLR slide (where `main` lands, rounded down to 16 KB), indexes
  `otool -tv` of `JS_Call`.
- **Correctness after every step:** the mquickjs-ae gate (16/16), its unit
  suites, `scripts/diff-upstream.sh` (24/24 identical to C), a clean full
  Octane run and a 400-case ASAN fuzz.

mquickjs-ae's own `AGENTS.md`, under "Performance", keeps the same summary
for people working on the engine, including the one rule the two-loop VM
adds: inside the opcode switch, a slow-path exit is `block = N  break`, never
`continue`.
