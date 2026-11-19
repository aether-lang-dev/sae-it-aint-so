# Rexx console: a guest language in a contained backend

Type Rexx, press Run. The script runs in the app's backend, a separate
process with [RexxAE](https://github.com/aether-lang-dev/RexxAE)'s engine
compiled in, contained and reaching nothing. What it `SAY`s streams back to
the page as it happens. This is
[aether-child-sandboxing](https://github.com/aether-lang-dev/aether-child-sandboxing)'s
Rexx showcase given a UI.

What it shows:

- **Errors** come back with their line: `error at line 2: unknown or
  unavailable function: NOSUCH`.
- **A time limit.** Each run has one (the page's field). The backend runs
  the script an instruction budget at a time (`rexxae_step`) and, past the
  limit, cancels it from inside the engine (`rexxae_cancel`): a
  `DO FOREVER` ends with `cancelled by host: its time limit of 500 ms
  passed`.
- **Cancel.** Between steps the backend looks for a call without waiting
  (`saebackend.poll`), so the page's Cancel reaches a script that loops
  forever.
- **The kill switch.** Some things a cancel cannot reach: an engine stuck
  inside one long native call, a bug. "Wedge it" stands in for that (the
  backend stops reading and never answers). Kill is `backend.restart()`:
  sae kills the backend process, fails the call that was waiting, tells
  `on_gone`, and starts a new one.
- **A flood, whole.** `DO i = 1 TO 20000; SAY i; END` sends twenty thousand
  events. Every one arrives in order; the page draws the last twelve at
  most every 50 ms.
- **Nothing to reach.** The engine has no system API, and the backend
  mounts no `ADDRESS` environment (a command gets `RC` 1) and one host
  function, `ELAPSED()`. The backend is started with `"sandbox": {}` (no
  grants; on Linux `sandbox.spawn_socket`), and its loop runs inside
  `sandbox.enforce` with no grants too.

Why the engine is in the backend, not in a `std.guest` worker under it: the
backend already is a contained child with nothing to reach; a worker under
it would need the backend granted `fork` and `exec`, more authority, not
less (`docs/design/ipc-backends.md`).

## Run it

It needs a RexxAE checkout beside sae (`../RexxAE`); its engine is compiled
into the backend from source:

```sh
cd apps/rexxconsole
AETHER_LIB_DIR=../../sdk:../../../RexxAE ae build backend/main.ae -o backend/main
cd ../..
target/build/bin/sae --app apps/rexxconsole
```

On Linux with Landlock the backend runs contained; elsewhere start the app
with `--uncontained-backend` (its own lockdown still holds it). Not on
Windows: the socket channel is POSIX only.

## Files

| File | What |
|---|---|
| `app.json` | the backend: `"channel": "socket"`, `"sandbox": {}`, a long `deadlineMs` (a run answers when it ends) |
| `index.ts` | the console: the script, its time limit, Run, Cancel, Wedge it, Kill, what it said |
| `backend/main.ae` | the backend: `run`, `cancel`, `wedge` |
| `../../tests/spec_app_rexxconsole.ae` | the spec: a run and its exit code, ELAPSED and ADDRESS, an error's line, the time limit, Cancel, a flood of 20,000 SAYs, and Kill on a wedged backend |
