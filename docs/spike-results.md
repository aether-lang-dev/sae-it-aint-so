# First spike: results

The design doc (`aether-ui/docs/design/tsyne-migrated.md`, "First spike:
measure before building") asked for numbers before building the rest. These
are from 2026-10-02, macOS arm64, Aether 0.761.0, aeb b0cc057, mquickjs-ae
`b9f88c4`, `-Os`. Reproduce with `SAE_NO_WINDOW=1 target/build/bin/sae <page>`,
which prints the per-phase timings and exits before the event loop.

## Page bytes to widgets

Medians of three runs, in microseconds. "widgets" is time inside the aether-ui
builder calls; "js" is the rest of the run (the engine).

| Page | parse | run | widgets | js | native widget calls |
|---|---|---|---|---|---|
| `pages/hello.js` (11 widgets) | 90 | 4,000 | 3,990 | 23 | 11 |
| `pages/bench/widgets200.js` (200 rows of text + button) | 60 | 61,700 | 61,350 | 387 | 601 |
| `pages/bench/compute.js` (sort/bucket 20k records, 12 widgets; `SAE_PAGE_MEM=16M`) | 123 | 113,500 | 500 | 112,900 | 12 |

Fixed costs per launch: AppKit's first widget (application start-up) is
about 40 ms, a `JSContext` is about 30 µs, reading a page file is about 20 µs.

**Reading:** for a layout page, the engine is noise. Each native widget costs
about 100 µs in AppKit, and the JS that asks for it costs under 1 µs. Parse is
under 0.2 ms for every page here, so a bytecode cache would save at most that
until the lowerer adds a second parse.

## The engine against Bellard's C

The same compute workload without the `ui` calls (`pages/bench/compute_core.js`),
run with each engine's own `mqjs` CLI, `--memory-limit 16M`, median of 20:

| Engine | median | startup only (`print(1)`) |
|---|---|---|
| mquickjs-ae (Aether port) | 117.4 ms | 1.8 ms |
| upstream C MicroQuickJS `7ea5399` | 13.3 ms | 1.6 ms |

**The port is about 9× slower than C on page logic.** That is worse than the
4.5× (Octane) to 7× (microbench) recorded in mquickjs-ae's AGENTS.md. That
file names the cause: `ae/vm.ae` dispatches opcodes through a linear
`if opcode == …` chain of about 124 compares rather than a jump table.

So: pages that are mostly layout are fine as they are. A page that does real
computation before it lays out (sorting thousands of records) pays about
100 ms where C would pay about 13 ms. That is a problem for the engine, fixable
in mquickjs-ae without touching sae, and nothing in sae's design depends on it.

## Not measured yet

- **Tsyne, cold and warm** (`tsyne-browser.sh`). This machine has no Node and
  no Go, and Tsyne's Fyne bridge is not built. Running it means installing
  both and building Tsyne.
- **Bytecode against source.** Parse is already under 0.2 ms, so this waits
  for the lowerer, when there are two parses per page to save.
