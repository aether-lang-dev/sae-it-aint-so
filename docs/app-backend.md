# An app's backend: its own process, on an inherited channel

A design note, 2026-11-10, for Paul and Nic. It began as "Tauri mode";
sae's app mode already has Tauri's shape (an installed app without browser
chrome, pages from its own folder, app.json grants in the place of Tauri's
capabilities, sae's services in the place of Tauri's core and its standard
plugins). What app mode lacked is Tauri's custom commands: the app's own
code a page reaches with `invoke`. This note is that, and only that.

## Where an app's code goes

Tauri's core exists mostly to get past the browser: the DOM and the web
sandbox cannot reach files, dialogs or the system. sae has native widgets
and a grant and services system designed in, so a backend is not how a page
gets those. It is for what should not be a sae service:

| A page needs | It goes in | Who answers for it |
|---|---|---|
| A generic effect any app may want (files, documents, clipboard, print, sqlite, http) | a sae service, under app.json grants | sae's kernel, reviewed once |
| Pure computation | natives: compiled into the app's host, capability-empty | the compiler's check (`ae inspect`) |
| The app's own effects (a protocol client, a file format that writes, an engine with state), or code that must run elsewhere (Linux code behind wslc on Windows) | the app's backend process | the app's author, the process kept apart |

So "my app needs X" is no longer a reason to grow the kernel: X is a
service only if every app may want it, and then it is reviewed as one.

## State

**Built (2026-11-10), the first slice; one transport since 2026-11-11**:
the backend's own stdin and stdout, two pipes (`os.run_stdio`, Aether
0.908.0), on macOS, Linux, FreeBSD (the backend specs on GhostBSD) and
Windows, and through `wslc run -i` to a Linux
backend in a WSL container on Windows. The socket pair it began on is gone.

- `app.json`, a program in the app: `"capabilities": { "backend": {
  "program": "backend/main", "args": [...], "deadlineMs": 10000 } }`.
  `program` is a file inside the app (`.exe` added on Windows); a path that
  climbs out, or a bad `deadlineMs` (100 to 600000), refuses the app. A
  program that is missing or does not start is said once, and the app runs
  without it: its pages' calls fail with why.
- `app.json`, a Linux program in a WSL container (Windows):
  `"capabilities": { "backend": { "wslc": { "image": "my-backend:1",
  "command": ["/app/backend", "--flag"] }, "deadlineMs": 10000 } }`. sae
  runs `wslc run --rm -i --pull never <image> <command...>`. `image` is
  required and may not start with `-` or hold a space, `command` (the
  program in the image and its arguments; empty runs the image's own) may
  not start with an option, `args` beside `wslc` and `program` beside
  `wslc` refuse the app. Anywhere but Windows the backend is refused at
  launch (said once, calls fail with "a wslc backend runs only on
  Windows ..."); sae does not fall back to docker or podman.
- The image must be there before the app starts: `--pull never`, so a
  missing one is wslc's "No such image" on sae's stderr and a backend that
  exits with status 1 (the reason says to pull or build it). wslc writes
  its pull progress to stderr, not stdout (checked on win11 with wslc
  3.0.5: stdout held only the program's bytes), so a pull would not break
  the frames; it is refused because it is a download nobody asked for at
  launch, and calls would time out behind it.
- The page: `"seeks backend"`, then `backend.invoke(name, arg)` (a promise
  for a string), `backend.on(name, fn)`, `backend.on_gone(fn)` and
  `backend.running()`.
- The backend: `sdk/saebackend` (`open`, `next`, `answer`, `fail`, `emit`),
  built with `AETHER_LIB_DIR=<sae>/sdk ae build backend/main.ae -o backend/main`.
  `saebackend.open()` claims stdin and stdout for the channel
  (`ipc.stdio_channel`): from then on a print, a library's diagnostic or a
  panic goes to stderr, never into a frame.
- In sae: `services/backend` (an instance per backend, no module state; the
  one place sae starts a program, held so by `tests/check_layers.sh`) and
  the "backend" section of `src/sae_host.ae`.
- A backend that breaks the protocol is stopped, and the reason quotes
  what it wrote, escaped, at most 48 bytes: `backend: it broke the
  protocol: "stray: printed before the claim\n" is not a frame (its stdout
  is the channel: nothing but frames may be written there)`. Likewise a
  frame that is not JSON, a stream that ends inside a frame, and a frame
  not whole within 2 s.
- Tests: `tests/apps/backend` and `tests/spec_app_backend.ae` (its args,
  answers, failures, events before the answer, print/println/raw fd 1
  writes after the claim kept out of the frames, the deadline, the backend
  exiting and being reaped, and `lsof` finding nothing listening);
  `tests/apps/backend_stray` and `spec_app_backend_stray` (output before
  the claim: stopped, the bytes quoted); `tests/apps/backend_wslc` and
  `spec_app_backend_wslc` (on Windows the same test backend built for Linux
  into `sae-backend-test:dev` by `tests/apps/backend_wslc/build-image.sh`,
  elsewhere the refusal); `tests/escape/computed_fs.ts` tries `backend` by
  a computed name.

Not yet: a picked document for the backend (no descriptor crosses a pipe),
containment, plugins, and anything about the bus.

## The shape

Tauri runs a trusted native core that opens a web view; the view's
JavaScript reaches the core only through `invoke` and events. sae can take
the same shape with the pieces it already has:

```
command line -> sae.exe --app <dir> [args]
                  |  prepares the page space and the window (as app mode does now)
                  |  os.run_stdio(<the app's backend>) -> (to_child, from_child, pid)
                  v
               backend (Aether, plus plugins), the channel its stdin and stdout
```

- sae is the parent. The app's backend, a program in Aether, is its
  child, started once per launch.
- The two talk over the child's stdin and stdout, two pipes that
  `os.run_stdio` makes: `std.ipc`'s length-prefixed frames and timed reads.
  No descriptor crosses a pipe.
- Pages reach the backend only through the page API, as they reach every
  other effect: the kernel is still the one door.

**For now this is one more way to put the pieces together**, beside a
page server (browser mode), an app folder (app mode), natives compiled
into the host, and the control bus. If it proves itself it could become
the one way an installed app has effects outside the page; that is a later
decision, not this note's.

## What the page sees

```ts
"seeks backend";
const r = await backend.invoke("open_project", JSON.stringify({ id: 7 }));
backend.on("progress", (msg: string) => set_text(status, msg));
backend.on_gone((why: string) => set_text(status, why));
```

- `backend.invoke(name, arg)`: one frame out, a Promise for the frame that
  answers it. Strings or plain JSON cross; no handles, no functions (the
  bus's rule).
- `backend.on(name, fn)`: frames the backend sends unasked. This is push
  to the page with no SSE, Comet or WebSocket, and no listening socket.
- `backend.on_gone(fn)`: the backend has exited, or broke the protocol, or
  never started; `fn(why)`. Every call waiting fails with the same why, and
  so does every later one.
- Sought and declared like any capability: a web page has no `backend`,
  and an app whose `app.json` names none refuses a page that seeks it.

## The frames

std.ipc's frames (a 4-byte length, then the bytes), each one JSON object:

```
sae -> backend   {"id": n, "call": "<name>", "arg": "<string>"}
backend -> sae   {"id": n, "ok": true, "result": "<string>"}
                 {"id": n, "ok": false, "error": "<message>"}
                 {"event": "<name>", "data": "<string>"}
```

At most 1 MB a frame. A frame that has begun must be whole within 2 s; a
backend that breaks either rule, or sends something that is not JSON, is
stopped. Strings only cross for now; a page that wants structure sends
JSON text.

## What the kernel does

- `app.json` names the backend: a program inside the app, compiled when
  the app is packaged (`tools/saehost.sh`, `tools/saepack.sh`), so whoever
  runs it needs no toolchain. Its own grants (files, network, sqlite) are
  declared there too, beside the page's.
- At launch, after the window: `os.run_stdio`. A UI timer reads the
  channel every 10 ms (a wait of 0, so it never blocks for a frame to
  start) and hands each frame to the page on the UI thread.
- The channel belongs to the app, not to a page: it survives navigation.
  (The bus's handler goes with its page; a backend does not.) A reply for
  a page that has gone is dropped, as an HTTP reply is.
- Bounded like everything else: a frame size limit, a queue limit, a
  deadline on each `invoke`, and the page told when one is missed.
- A document the person picks could be opened by sae and handed over, so a
  backend without `fs` still reads exactly that file and no other. Not
  over the pipes (no descriptor crosses one): its bytes in frames, or a
  second channel; open.
- At exit: the channel closed, a grace period, then the child killed and
  reaped (`os.wait_pid`). A backend that dies is reported to the page; it
  does not take the window with it.

## Alice, Bob and Eve

Alice runs the app; Bob wrote it; Eve wants to drive it, or read what it
holds. What changes is how much there is for Eve to find.

| Eve is | The control bus today | A backend on an inherited channel |
|---|---|---|
| Another account on the machine | Must not read `$APPDATA/.control-bus` (address and key). Rests on the file's 0600, and on Windows that is not set yet (`docs/windows.md`) | Nothing to read: no file, no address, no key. The channel is two anonymous pipes that exist only as descriptors in sae and in the child |
| Another account, connecting | Can reach the loopback port; refused without the key, every frame sealed | Nothing to connect to: nothing listens |
| A web page in some browser | Can send to 127.0.0.1; refused by the key, the `Origin` and `Host` checks (DNS rebinding) | Nothing to send to |
| A page inside sae | Has no `bus` object unless it is the app's page and seeks it | Has no `backend` object unless it is the app's page and seeks it; reaches it only through `invoke` |
| A program that took a stale port | Its replies do not open (sealed both ways) | No port; the child is the process sae started |
| Malware running as Alice | Can read the courier file and drive the app | Can attach to either process (ptrace, a debugger), as it could to any of Alice's programs |

The last row is the honest limit: nothing on one account defends against
code already running as that account; only containing the processes
(below) narrows it. Every other row is "nothing for Eve to find", which
is the point of an inherited channel: the capability is holding the
descriptor, and only sae and the child it started hold one.

## What it does not replace

- **Scripts started on their own** (spraedsheet's REXX from a shell, an
  AI client's MCP server it launched itself) cannot inherit a descriptor
  from a sae that is already running. For those there is still the bus,
  or, better than its loopback port, a Unix socket in a 0700 directory
  (no port, no key, no browser can reach it; Aether has `tcp.listen_unix`).
  Or the other way round: the MCP server starts sae, holds the channel,
  and so owns the instance it drives.
- **Across machines**: a Linux script, a Linux server and a Windows sae
  meet on the server (the page long-polls it). Across the WSL boundary a
  backend sae starts itself does cross, through `wslc run -i` (above); a
  Linux server started on its own does not.
- **Natives** stay: compiled into the host, capability-empty, for pure
  functions where a frame round trip would cost too much. A backend is for
  effects.

## Transports

One: the backend's stdin and stdout, two pipes, on every platform. What
differs is only what sae starts.

| Backend | Where | sae starts | Descriptors |
|---|---|---|---|
| a program in the app | macOS, Linux, the BSDs, Windows | the program, `os.run_stdio` | no |
| a Linux program in a WSL container | Windows | `wslc run --rm -i --pull never <image> <command...>`, `os.run_stdio` | no (nothing crosses the VM) |

wslc, checked on win11 (2026-11-10/11, wslc 3.0.5): the container's stdin
and stdout are the program's, byte for byte, and a warm start takes about
1.3 s, once per launch; the first after WSL's VM had stopped took more than
10 s (a backend's first call needs a `deadlineMs` that allows for it). With `--pull missing` (wslc's default) an image
pull's progress goes to stderr; stdout held only the program's output.
wslc has no daemon socket, and the channel is the two pipe handles sae
holds, so the Alice/Bob/Eve table above holds for it too.

The socket pair the first slice used (`os.run_socket`, fd 3, descriptor
passing) was removed on 2026-11-11 rather than kept beside the pipes: it
did not run on Windows and nothing yet passed a descriptor.

## Open

1. **Containment.** `sandbox.spawn_socket` contains a child only on Linux
   with Landlock today; on macOS and Windows it refuses
   (`../aether-child-sandboxing`). Tauri's core runs uncontained; whether
   Bob's backend may, and on which platforms, is a decision, not a default.
   A wslc backend is in a container already (its own file system and
   network namespace in WSL's VM).
2. **The frame protocol**: names, ids for matching replies, errors,
   cancellation (the guest-language work in aether-child-sandboxing has
   `CANCEL` with a grace period; reuse it rather than invent one).
3. **Plugins**: what "Aether plus plugins" means for a backend (contrib
   modules, other Aether libraries) and how `app.json` declares them.
4. **A picked document for the backend**, now that no descriptor crosses
   the channel (What the kernel does, above).
5. **The bus's future**: if backends and a Unix socket cover its cases,
   the loopback TCP bus, its courier file and its sealing could go.

Done: Windows (2026-11-11, the stdio transport, native and wslc), and
stray output (`saebackend.open()` claims stdin and stdout with
`ipc.stdio_channel`; what still breaks the stream, output before the claim
or from a wrapper, is quoted in the reason). Not masked even now: output
before the claim, C code holding its own copy of fd 1, and a child process
started before the claim.
