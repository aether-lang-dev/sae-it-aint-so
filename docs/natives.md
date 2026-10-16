# Natives: an app's own compiled code, called by its pages

Built 2026-10-16, for the chess app (`../chaess`, its TODO.md 4.4): its
engine in Aether is a thousand times faster than the same search in the
page's TypeScript on QuickJS, and its page could not reach it. The design
holds to three things:

- **Linked at build time, never loaded.** An app's native modules are
  compiled into a sae of its own; nothing is loaded when the app runs. So
  the same works where an app may not load code (iOS, guideline 2.5.2), and
  there is no loader to attack.
- **Confined by the compiler.** A native module may compute and nothing
  else: Aether's `ae inspect` must call it *capability-empty* (no `std.fs`,
  `std.net`, `std.os`, no clock, no `extern` C). It cannot reach a file,
  the network, the system or the page; it gets a string and gives one.
- **A declared surface.** The page sees only the functions app.json
  declares, and only when it seeks the module.

## Declaring one: app.json

```json
"natives": {
  "engine": {
    "module": "native/engine.ae",
    "functions": ["search", "perft"]
  }
}
```

A module is one Aether file inside the app, a module rather than a program
(no `main`), exporting each declared function as

```aether
search(arg: string) -> (string, string)     // the answer, and "" or why there is none
```

It may export more; only what `functions` lists is reachable. The names
are identifiers (a letter or `_`, then letters, digits and `_`).

## Building the app's own sae: tools/saehost.sh

```sh
tools/saehost.sh <app-dir> [out-dir]                 # sae
AETHER_UI_WITH_DRIVER=1 tools/saehost.sh <app-dir>   # and sae-driver
<out-dir>/target/build/bin/sae --app <app-dir>
```

`out-dir` defaults to `target/hosts/<app name, lower case>`. It runs
`tools/saenatives.ae` (built to `target/saenatives`), which reads app.json,
checks each module (`ae inspect`: a module, capability-empty, exporting each
declared function with the one shape) and refuses the app's build, saying
why, when one is not; copies each module to
`<out-dir>/app_natives/<name>/module.ae`; and writes
`<out-dir>/natives/module.ae`, the dispatch the kernel calls. Then it builds
sae there, its sources linked in, as `./build.sh` builds it.

sae's own tree has `natives/module.ae` as the stub with none, so sae itself,
and any app built without its natives, has no native module at all.

## Calling one: the page

```ts
"seeks native engine, reduced functionality without";

if (typeof natives !== "undefined") {
  const line = await natives.engine.search("4|0|<fen>|");   // a promise of a string
}
```

`"seeks native <name>"` is a privilege of its own, as `database <name>` is.
The kernel gives the page `natives.<name>`, frozen, with the declared
functions, when the app declares the module and this sae has it compiled
in; one this sae lacks is said at start (`sae: native engine: not in this
sae (missing: ...)`), a page that seeks it as required is refused, and one
that can do without it has no `natives` and takes its own path (the chess
page searches in TypeScript then).

Each call is a promise. It runs off the UI thread on aether-ui's
`background` (a pool thread; the completion comes back on the UI thread),
one call at a time per module, in the order the page made them, so a
module's own state (the chess engine's tables) is touched by one call at a
time. The module's error rejects the promise with an `Error`
(`native engine.search: ...`). A reply for a page that has since been left
is dropped. Not an actor: a call may compute for seconds, and an actor that
does holds its scheduler core, and the UI thread's asks of the actors there.

## What is held, and where

| Rule | Held by |
|---|---|
| A module needs no capability | `ae inspect`'s "capability-empty", checked by saenatives before anything is built; the compiler then compiles the module with only what it imports |
| Only declared functions | the generated dispatch names only them; the page's object has only them; the gate refuses another name |
| Only for a page that seeks it | the lowerer's `seeks native <name>` (it takes the name, as `database` does); the kernel leaves `natives` out for a page that does not |
| Nothing loaded at run time | there is no loading code: a module is in the binary or it is not |

The rules are in `tests/check_natives.sh` (each refusal, and a module that
is taken); `tests/spec_app_natives.ae` drives `tests/apps/natives` on its
own host (the declared functions and no more, promises, order, a module's
error, a long call while the page answers clicks) and on sae's own sae-driver
(the module absent, the page refused).

## iOS

Nothing here is iOS-specific, and nothing in it is what iOS forbids: the
modules are compiled into the app's one binary, as a static library would
be (an App Store build may not carry its own dylibs either), and no code
arrives at run time. A native module compiles for the phone as it is
(`ae build native/engine.ae --target aarch64-ios --emit=staticlib --with=`:
no capabilities granted, and none needed), which `tests/check_natives.sh`
does on a Mac with Xcode. What sae does not have yet is its own iOS
packaging (a `saepack` for iOS, as `tools/saepack.sh` is for macOS and
`tools/saepack-android.sh` for Android); when it has, an app's own host is
built for iOS as `tools/saehost.sh` builds it here.

## Not done

- **Android.** `tools/saepack-android.sh` stages sae's own `natives/` (the
  stub); staging the generated one there is the same step as saehost's.
- **Cancelling a call.** A call runs to its end; a page that wants to stop
  sooner passes a budget in its argument (the chess engine's node count).
- **Several modules' calls at once.** Each module has its own order;
  different modules' calls can run at the same time, each on its own pool
  thread.
