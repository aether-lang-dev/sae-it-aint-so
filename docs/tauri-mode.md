# Tauri mode: an app's own backend process, on an inherited channel

A design note, 2026-11-10, for Paul and Nic.

**Built (2026-11-10), the first slice**, on macOS and Linux (the BSDs
should follow; not yet run there). Windows waits on Aether: `os.run_socket`
answers "unsupported on Windows" (Open, 1).

- `app.json`: `"capabilities": { "backend": { "program": "backend/main",
  "args": [...], "deadlineMs": 10000 } }`. `program` is a file inside the
  app (`.exe` added on Windows); a path that climbs out, or a bad
  `deadlineMs` (100 to 600000), refuses the app. A program that is missing
  or does not start is said once, and the app runs without it: its pages'
  calls fail with why.
- The page: `"seeks backend"`, then `backend.invoke(name, arg)` (a promise
  for a string), `backend.on(name, fn)`, `backend.on_gone(fn)` and
  `backend.running()`.
- The backend: `sdk/saebackend` (`open`, `next`, `answer`, `fail`, `emit`),
  built with `AETHER_LIB_DIR=<sae>/sdk ae build backend/main.ae -o backend/main`.
- In sae: `services/backend` (an instance per backend, no module state; the
  one place sae starts a program, held so by `tests/check_layers.sh`) and
  the "backend" section of `src/sae_host.ae`.
- Tests: `tests/apps/backend` and `tests/spec_app_backend.ae` (its args,
  answers, failures, events before the answer, the deadline, the backend
  exiting and being reaped, and `lsof` finding nothing listening);
  `tests/escape/computed_fs.ts` tries `backend` by a computed name.

Not yet: passing a picked document's descriptor (`ipc.send_fd`),
containment, plugins, and anything about the bus.

## The shape

Tauri runs a trusted native core that opens a web view; the view's
JavaScript reaches the core only through `invoke` and events. sae can take
the same shape with the pieces it already has:

```
command line -> sae.exe --app <dir> [args]
                  |  prepares the page space and the window (as app mode does now)
                  |  os.run_socket(<the app's backend>) -> (channel, pid)
                  v
               backend (Aether, plus plugins), its end of the channel at fd 3
```

- sae is the parent. The app's backend, a program in Aether, is its
  child, started once per launch.
- The two talk over the `AF_UNIX` socket pair that `os.run_socket` makes:
  `std.ipc`'s length-prefixed frames, timed reads, and descriptors passed
  with `send_fd`/`recv_fd`.
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
- At launch, after the window: `os.run_socket`. The channel is read on an
  actor and its frames are delivered on the UI thread, the pattern sae's
  HTTP already uses.
- The channel belongs to the app, not to a page: it survives navigation.
  (The bus's handler goes with its page; a backend does not.) A reply for
  a page that has gone is dropped, as an HTTP reply is.
- Bounded like everything else: a frame size limit, a queue limit, a
  deadline on each `invoke`, and the page told when one is missed.
- A document the person picks is opened by sae and handed over as an
  open descriptor (`ipc.send_fd`), so a backend without `fs` still reads
  exactly that file and no other.
- At exit: the channel closed, a grace period, then the child killed and
  reaped (`os.wait_pid`). A backend that dies is reported to the page; it
  does not take the window with it.

## Alice, Bob and Eve

Alice runs the app; Bob wrote it; Eve wants to drive it, or read what it
holds. What changes is how much there is for Eve to find.

| Eve is | The control bus today | Tauri mode |
|---|---|---|
| Another account on the machine | Must not read `$APPDATA/.control-bus` (address and key). Rests on the file's 0600, and on Windows that is not set yet (`docs/windows.md`) | Nothing to read: no file, no address, no key. The channel is a socket pair that exists only as two descriptors, one in each process |
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
- **Across machines or across the WSL boundary**: a Linux script, a Linux
  server and a Windows sae meet on the server (the page long-polls it).
  `AF_UNIX` does not cross from WSL2's VM to Windows.
- **Natives** stay: compiled into the host, capability-empty, for pure
  functions where a frame round trip would cost too much. A backend is for
  effects.

## Open

1. **Windows spawn.** `os.run_socket` is built on `socketpair`; it is not
   yet checked on Windows (AF_UNIX there needs Windows 10 1803 or later).
   If it does not work, that is an Aether gap to fill first.
2. **Containment.** `sandbox.spawn_socket` contains a child only on Linux
   with Landlock today; on macOS and Windows it refuses
   (`../aether-child-sandboxing`). Tauri's core runs uncontained; whether
   Bob's backend may, and on which platforms, is a decision, not a default.
3. **The frame protocol**: names, ids for matching replies, errors,
   cancellation (the guest-language work in aether-child-sandboxing has
   `CANCEL` with a grace period; reuse it rather than invent one).
4. **Plugins**: what "Aether plus plugins" means for a backend (contrib
   modules, other Aether libraries) and how `app.json` declares them.
5. **The bus's future**: if Tauri mode and a Unix socket cover its cases,
   the loopback TCP bus, its courier file and its sealing could go.
