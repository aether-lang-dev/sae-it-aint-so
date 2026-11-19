# A backend on a socket: descriptors, containment, and three example apps

A design note, 2026-11-19, for Paul and Nic. Paul asked for example sae apps
that show what Aether's `std.ipc` makes possible. This note says where
`std.ipc` earns a place in sae beside what `docs/app-backend.md` already
built, what changes in sae for it, and which three apps show it.

## Where sae is today

An app's backend (`docs/app-backend.md`) is its own process, started by
sae with `os.run_stdio`, and the channel is the child's stdin and stdout:
two pipes, `std.ipc`'s length-prefixed frames, one JSON object a frame.
The page reaches it with `backend.invoke`, `backend.on` and
`backend.on_gone`. It runs on macOS, Linux, the BSDs and Windows, and
through `wslc run -i` to a Linux backend in a WSL container.

It began on a socket pair (`os.run_socket`) and moved to the pipes on
2026-11-11, because the socket did not run on Windows and nothing yet
passed a descriptor. Its "Open" list still has three items the pipes cannot
close: a document the person picked, for a backend with no file-system
grant (open item 4); containment (open item 1); and the backend's stdout,
which is the channel, so a stray print breaks it.

## What a socket gives that the pipes cannot

`os.run_socket` hands the child one end of an `AF_UNIX` stream socket at
fd 3. Over it:

1. **An open descriptor crosses** (`ipc.send_fd` / `ipc.recv`). sae can
   open the file the person picked and hand the backend the open file, so
   a backend that may open nothing still reads exactly that file. The
   descriptor is the capability; the path never crosses. Descriptors only
   go down: std.ipc refuses one a child sends up, with no opt-in.
2. **Containment comes with it.** `sandbox.spawn_socket(grants, ...)` is
   `os.run_socket` with the child held to a grant list: the sandbox
   preload in the child's libc, and on Linux Landlock and a seccomp filter
   under it. It fails closed: where it cannot contain the child (macOS,
   Windows, FreeBSD for now, Linux without Landlock) it starts nothing.
   There is no contained `run_stdio`, so containment is a socket-only
   thing today.
3. **The child's stdout is its own.** A print, a library's diagnostic, a
   panic or a child process of the backend writes where sae's own output
   goes, and cannot break a frame.

And what it does not give: Windows (std.ipc has no socket channel and no
descriptor passing there), and a container runtime in the middle (`wslc
run -i` passes stdin and stdout, not a socket).

## Decision: a second transport beside the pipes

Not a replacement. The pipes are the only channel on Windows and through
wslc; the socket is the only one that carries a descriptor or a sandbox.
Each app says which it wants, and the frames, the page API and the
backend's library are the same for both.

```json
"backend": {
  "program": "backend/main",
  "channel": "socket",
  "sandbox": { "read": ["$TEMP/"], "env": ["HOME"] }
}
```

- `"channel"`: `"stdio"` (the default, what every backend has now) or
  `"socket"`. A socket backend on Windows is refused at launch, said once,
  as a wslc backend is anywhere but Windows.
- `"sandbox"`, for a socket backend only, and required there: the app's
  author says either what the backend may reach or that it is not
  contained, never by leaving something out.
  - An object of grants: sae starts the backend with
    `sandbox.spawn_socket`. `{}` is nothing at all (an Aether backend
    needs no grants to start). The keys are `read` and `write` (paths, as
    app.json's `fs` grants write them: `$APPDATA`, `$HOME`, `$TEMP` and the
    others at the front; a relative path is inside the app's folder, as
    `program` is), `env` (variable names) and `runtime` (an interpreter
    whose own library it must read to start, `grant_runtime`'s names:
    `python3`). Nothing else yet (no exec, no network); an unknown key
    refuses the app, so a grant is never silently dropped.
  - `"none"`: sae starts it with `sandbox.spawn_socket_uncontained`, and
    says so every launch (`sae: backend: backend/main started, not
    contained (app.json sandbox "none")`).
- Where `spawn_socket` cannot contain the child, the backend does not
  start, the reason is said once, and the app runs without it (its pages'
  calls fail with that reason), as for a program that is missing.
- **The person's override**: `sae --app <dir> --uncontained-backend` starts
  a socket backend with no process sandbox whatever app.json says, said at
  launch. It is the person's choice, for running an app where containment
  is not built (macOS today), never the app's or a page's. It is
  `make UNCONTAINED=1` in aether-child-sandboxing.
- The stdio channel stays as it is: uncontained, and `"sandbox"` beside it
  refuses the app rather than being ignored.

Why the author must choose: open item 1 of `docs/app-backend.md` says
whether Bob's backend may run uncontained "is a decision, not a default".
Making the key required on the new transport is that decision put where
Bob has to make it; leaving the stdio transport uncontained keeps the
Windows and wslc backends running, and is said in the docs.

## A picked document for the backend

```ts
"seeks documents";
"seeks backend";
const d = await documents.pick_open("A file to count");
if (d) set_text(out, await backend.invoke("count", "", d));
```

- `backend.invoke(name, arg, doc)`: the optional third argument is a
  handle `documents` gave this launch. The kernel opens that file, read
  only, through `services/documents` (inside its one-file sandbox, as every
  read of a picked file is), and sends the open descriptor with the call.
  The frame says so (`"fd": true`) and the descriptor follows on one byte
  after it (`ipc.send_fd`), the shape aether-child-sandboxing's `GRANT`
  uses. sae's copy is closed once it has been sent.
- A handle names a document by a number the kernel gave; the page cannot
  make one for a file the person did not pick (the number is held on the
  handle as a non-enumerable `Symbol.for("sae.document")` property, and the
  kernel checks it is one of this launch's picks). Documents belong to the
  launch, so this widens nothing: any page of the app may read them already.
- Refused, with the reason, on a stdio backend (no descriptor crosses a
  pipe) and when the app was not granted `documents`.
- Read only. A descriptor to write (a picked save target) is not handed
  over yet.
- The backend takes it with `saebackend.handed(sb)` after `next`, and
  closes it when done.

## The backend's side

`sdk/saebackend` keeps one `open()`: it takes the socket when sae started
the backend on one (`ipc.parent_channel_kind()` is `"socket"`) and claims
stdin and stdout otherwise, so a backend is the same program on either
transport. Two calls are added:

- `handed(sb) -> int`: the descriptor that came with the call `next`
  returned last, or -1. The caller owns it.
- `poll(sb) -> (id, name, arg, err)`: `next` without waiting, `name` ""
  when no call is waiting. A backend doing a long job looks between its
  steps for a `cancel` call (or any other) without a thread.

An Aether backend can contain itself as well, on every platform: after
`open()` it runs its loop inside `sandbox.enforce` with no grants (the
`std.guest.child` shape), so its own std calls are refused even where the
process sandbox is not built. The example apps all do; it is std, not an
SDK call.

## The kill switch: `backend.restart()`

A backend stuck in native code, or one the person wants gone, cannot be
reached by a `cancel` call. `backend.restart()` kills it at once (no
grace: it is the kill switch), fails every waiting call and tells
`on_gone` ("backend: restarted by the page"), then starts a new one from
the same declaration. It returns a promise that resolves when the new
backend is running and rejects with why it is not. The start is an effect
outside the page, so it is queued and done after the page's entry, as
`shell.open` is. Both transports.

## How it stays inside sae's rules

- **The gate spec is the boundary.** The new page-facing pieces are one
  optional argument to `invoke` and `restart()`, both in the `backend`
  space a page has only when it seeks `backend` in an app that declares
  one.
- **Effects through services.** Starting the backend, contained or not,
  stays in `services/backend`, the one place sae starts a program
  (`tests/check_layers.sh`), which now imports `std.sandbox` for
  `spawn_socket`. Opening the picked file for the backend is
  `services/documents`, under its one-file grant.
- **Nothing shared.** The grant list belongs to the backend instance, and
  is freed with it.
- **Nothing listens, no file is written.** The socket is a pair: one end
  in sae, close-on-exec, the other the child's fd 3.

## More than one channel

A socket pair also lets sae hand the backend a second channel
(`os.socketpair`, one end sent as a descriptor), for bulk bytes beside the
calls, or one channel per page. Not built: the three apps below do not
need it, and the 1 MB frame limit and the write bound already keep one
channel moving. It is the next step if an app streams more than events.

## Three example apps

Each is under `apps/`, laid out like `apps/tasks`, with a README that says
what it shows and a spec under `tests/` driven through the driver.

1. **`apps/docstats`, a document worker.** The person picks a file; the
   page hands the open descriptor to a backend that has no grants at all
   and is locked down in-process too. The backend reads it and streams
   back lines, words, bytes, a CSV summary when it is one, and a SHA-256,
   with progress events as it goes. The spec proves the backend cannot
   open the same path itself (refused, by the process sandbox on Linux and
   by its own lockdown everywhere) and reads the descriptor it was handed.
2. **`apps/rexxconsole`, a guest language with a UI.** The backend has
   [RexxAE](https://github.com/aether-lang-dev/RexxAE)'s engine compiled in and runs the Rexx the
   person types, an instruction budget at a time: its `SAY`s stream back
   as events, an error comes back with its line, a script over its time
   limit is cancelled from inside the engine, and the page's Kill button is
   `backend.restart()`, which also ends a backend stuck where a cancel
   cannot reach. This is aether-child-sandboxing's Rexx showcase given a
   UI. Why the engine in the backend rather than a `std.guest` worker
   under it: the backend already is a contained child with nothing to
   reach; a worker under it would need the backend granted `fork` and
   `exec`, which is more authority, not less. Why not Python: a foreign
   interpreter needs its own library granted to start (`runtime`) and a
   wrapper speaking sae's frames; RexxAE needs neither, and is the
   family's own Rexx, the one spraedsheet's scripts speak.
3. **`apps/treewalk`, a long job on a live channel.** The backend walks a
   folder the app's grants allow, pushing what it finds as events the page
   did not ask for, while the page stays responsive; Cancel stops it
   between entries (`poll`). It shows back-pressure (a flood of events is
   written as fast as sae takes them, 32 a tick, and the backend's write
   waits, not the window), navigation (the job belongs to the app: another
   page loads, the walk goes on, and the page coming back asks where it
   is), and a backend that dies mid-walk (`on_gone`, then
   `backend.restart()`).

## Per platform

| | stdio channel | socket channel | socket, contained | a picked document |
|---|---|---|---|---|
| Linux | yes | yes | yes, with Landlock (5.13+) | yes |
| macOS | yes | yes | no: refused; `--uncontained-backend` | yes |
| FreeBSD | yes | yes | no: refused (spawn_socket has no kernel layer for a foreign program there yet) | yes |
| Windows | yes (and wslc) | no: refused | no | no |

To be confirmed on each host before the docs say it as fact; the specs
run on cachyos (Linux), and the headless parts on macOS.
