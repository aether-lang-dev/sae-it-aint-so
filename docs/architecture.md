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
| **Page host** | one QuickJS runtime per page (contrib.quickjs): heap cap, time limit per entry, timers, handle ownership; the only code that enters JavaScript | nothing | the gate |
| **Guest** | the page: modern TypeScript, its types erased, run by QuickJS | what its page API objects offer | the objects `api_register_` installs for its mode |

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
5. **What the page seeks, checked twice.** `"seeks local-filesystem";`
   (and `outgoing-http`, `open-urls`) at the top of a page: the lowerer
   refuses a page that names `fs`, `http` or `shell` without seeking it,
   and the kernel refuses, before any of it runs, a page that seeks what
   its context does not grant, saying what is missing.

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
| 2 | per-mode objects: **done** (a web page's runtime has no `fs` or `shell` object at all). Still to do: the gate generated from one spec (argument types, capability and service per call) instead of hand-written, retiring the 75 pasted `hide` lines for one compiler-checked module boundary | next |
| 3 | `sandbox.enforce(page_grants)` around every entry into page code (page run, handlers, timers, http callbacks), as a runtime backstop in std | |
| 4 | `storage`, `net`, `ui` as services; the kernel stops importing what only a service needs | |
| later | the page host and guest in a separate process, sandboxed by the OS (Linux `spawn_sandboxed` and seccomp; macOS has no equivalent yet), so a memory-safety bug in the engine is contained too | |

### What stays C, and why

`src/sae_rom.c` is `main()` and the stdout handle, a dozen lines. The engine
is Aether's `contrib.quickjs`, whose C (aether_quickjs.c over QuickJS's
amalgamation) turns QuickJS's 16-byte `JSValue` into integer handles and
calls every page-API function through one dispatcher, so the page API is
all Aether, registered at run time by `api_register_`.

## Limits

- The layers stop sae's own code from reaching an effect by another route;
  they do not contain the engine. A memory-safety bug in QuickJS's C
  runs in sae's process and can do anything sae can. That is what the
  separate-process stage is for.
- CPU and memory are capped per page: each entry into its JS (the page's
  run, a handler, a timer, an http callback) is stopped after 5 s, and its
  heap at 32 MB.
