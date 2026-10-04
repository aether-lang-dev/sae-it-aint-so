# sae's architecture: who may do what

sae runs untrusted code (a web page) and less-untrusted code (an app the
user installed) beside trusted code (sae itself), in one process. This page
is how that process is split, by who holds authority, and how each line is
held: by the compiler where Aether can say it, by a checked rule where it
cannot yet, and at run time as a backstop.

## The layers

| Layer | What it is | Holds | Can reach |
|---|---|---|---|
| **Kernel** | the event loop, navigation, fetching and lowering pages, app.json, the grant table, the http actors | all of sae's authority | everything it imports |
| **Services** | one module per effect a page can ask for: `files`, `shell`, later `storage`, `net`, `ui` | one effect each, checked against the grants | only their own imports |
| **Gate** (the page ABI) | one function per page-API call: unpack the JS arguments, check the page owns any handles, call the service, pack the result or throw the refusal | nothing | the services and engine values |
| **Page host** | one mquickjs context per page: heap, GC roots, timers, handle ownership; the only code that enters JavaScript | nothing | the gate |
| **Guest** | the page: TypeScript lowered to ES5, run by mquickjs-ae | what its page API objects offer | the ROM objects of its mode |

Authority flows one way: the kernel configures the services (roots, grants)
and the guest can only ask, through the gate, for what a service will do.

## How each line is held

1. **Imports, checked by the compiler.** An Aether module can name only what
   it imports. `services/files` imports `std.fs`, `std.dir`, `std.string`
   and `std.strarr`, so it cannot open a URL, read the environment or reach
   the network. `services/shell` imports exactly `ui (open_url)` and
   `std.fs (read, write_atomic)` (the spec log).
2. **The page veto, checked by the compiler.** Every gate function opens
   with a `hide` line naming the kernel (fs, os, the network client, the
   lowerer, page lifecycle, the engine's parse/run), so a gate cannot name
   them at any depth (`tests/check_page_veto.sh`).
3. **Layer rules, checked by a script.** `tests/check_layers.sh` holds each
   service to its exact import list (widening one is a reviewed change to
   that script) and fails if `open_url` is named anywhere but
   `services/shell`. The kernel imports all of `ui` to build the browser,
   and Aether can hide a namespace but not one of its members
   (`asks/aether-hide-one-member.md`); when it can, the rule becomes a
   `hide ui.open_url` the compiler checks.
4. **Grants, checked at run time by the services.** Every path is resolved
   to where it leads and every URL compared with the app's grants before
   anything is touched (`docs/app-capabilities.md`).
5. **The page's own seal, checked by the lowerer.** `"seal except ui,
   http";` at the top of a page limits what it may name.

### Shell: the URL opener

AppKit's URL opener is not a std call, so Aether's `std.sandbox` cannot see
it; it is held by the layers instead. Only `services/shell` can name it
(rules 1 and 3), the service opens only URLs whose prefix the app's
`app.json` grants, and a web page in the browser gets a refusal. A build
that leaves `services/shell` out has no route to the opener at all.

## Where sae is now

| Stage | | |
|---|---|---|
| 1 | `services/files`, `services/shell` split out of the kernel; `tests/check_layers.sh` | **done** |
| 2 | the gate generated from one spec (`gen/sae_spec.ae` grows argument types, capability and service per call) instead of hand-written, retiring the 77 pasted `hide` lines for one compiler-checked module boundary; per-mode ROM tables, so the browser's pages have no `fs` or `shell` object at all rather than ones that refuse | next |
| 3 | `sandbox.enforce(page_grants)` around every entry into page code (page run, handlers, timers, http callbacks), as a runtime backstop in std | |
| 4 | `storage`, `net`, `ui` as services; the kernel stops importing what only a service needs | |
| later | the page host and guest in a separate process, sandboxed by the OS (Linux `spawn_sandboxed` and seccomp; macOS has no equivalent yet), so a memory-safety bug in the engine is contained too | |

### What stays C, and why

`src/sae_rom.c` is about 60 lines: the ROM table (mquickjs keeps native
functions in a static read-only table, a C initialiser that
`gen/sae_spec.ae` generates), one-line shims for engine constants and
calls that `mquickjs.h` defines as macros (`JS_UNDEFINED`, `JS_NewBool`,
the variadic `JS_ThrowTypeError`), the log sink and `main`. The page-API
functions themselves are Aether (`@c_callback`). Both C parts could go:
mquickjs-ae exporting those constants as functions, and the ROM table
generated as Aether if Aether can express a static array of function
pointers.

## Limits

- The layers stop sae's own code from reaching an effect by another route;
  they do not contain the engine. A memory-safety bug in mquickjs-ae's C
  runs in sae's process and can do anything sae can. That is what the
  separate-process stage is for.
- A page can still spend CPU and memory without limit (an infinite loop); the
  page heap is capped (1 MB) but time is not.
