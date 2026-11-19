# Treewalk: a long job on a live channel

The backend walks a folder and pushes what it finds to the page as it goes:
an event for every file, and the counts a few times a second. The page did
not ask for any of them, one by one; it asked for a walk.

What it shows:

- **Push, with no polling and no listening socket.** `saebackend.emit` on
  the backend's side, `backend.on("found", ...)` and
  `backend.on("progress", ...)` on the page's.
- **The page stays responsive.** sae reads the backend's socket a tick at a
  time (32 frames a tick) and never waits on it; the walk goes on in the
  backend's own process.
- **Back-pressure, not loss.** A walk of ten thousand files is ten thousand
  events. When the page's side cannot keep up, the socket fills and the
  backend's `emit` waits: the walk slows to the page's pace, and every
  event arrives. The page draws the last eight files at most ten times a
  second, however fast they come.
- **Cancel.** Between entries the backend looks for a call without waiting
  (`saebackend.poll`), so Cancel stops the walk where it is.
- **Navigating away.** The backend belongs to the app, not to a page.
  "Another page" loads a page that does not listen; the walk goes on. The
  page coming back asks the backend where it is (`status`), and then hears
  the rest. The walk's own answer went to the page that asked for it, and
  was dropped with that page, as an HTTP reply is.
- **A backend that dies.** "Crash it" makes the backend exit mid-walk: the
  page's `on_gone` hears `backend: it exited with status 3`, the call that
  was waiting fails with the same, and Restart (`backend.restart()`) starts
  a new one.
- **Grants.** `app.json` lets the backend read under `$HOME` and `$TEMP` and
  read the `HOME` variable, and nothing else: a walk of `/etc` is refused
  (on Linux, `sandbox.spawn_socket`; Landlock holds it).

## Run it

```sh
cd apps/treewalk
AETHER_LIB_DIR=../../sdk ae build backend/main.ae -o backend/main
cd ../..
target/build/bin/sae --app apps/treewalk
```

On Linux with Landlock the backend runs contained; elsewhere start the app
with `--uncontained-backend`, and it may then read anything you can. Not on
Windows: the socket channel is POSIX only.

## Files

| File | What |
|---|---|
| `app.json` | the backend: `"channel": "socket"`, read grants for `$HOME/` and `$TEMP/`, `HOME` |
| `index.ts` | the walk's page: the folder, Walk, Cancel, Crash it, Restart, what it found |
| `about.ts` | another page, to leave the walk running behind |
| `backend/main.ae` | the backend: `walk`, `status`, `cancel`, `crash` |
| `../../tests/spec_app_treewalk.ae` | the spec: ten thousand files, every event counted, the window answering the driver within a second throughout; Cancel; another page and back; `/etc` refused; a crash and a restart |
