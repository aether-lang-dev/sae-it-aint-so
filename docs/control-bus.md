# A control bus: may an installed app accept local connections?

A design note, decided by Paul (2026-10-14). **Option (a) is built**
(2026-10-14): `services/bus`, with aeo's `agent_auth` and `secure_channel`
copied into `services/` (to be shared later); `"seeks control-bus"` and
`bus.serve`/`bus.stop`; `--control-bus` after `sae --app <dir>`; the
spreadsheet serves it (aether-lang-dev/spraedsheet, once demo 18:
its `app/app.json`, `tests/specs/spec_app_sheet_bus.ae`);
`tests/spec_app_bus.ae`, `spec_app_bus_off.ae`; and `sae-bus`
(`tools/saebus.ae`), the client other programs run, which the
spreadsheet's REXX scripts reach through an ADDRESS library of their own
(see "The wire"). Not yet: a window toggle (the launch flag is the
switch), and an installer (decision 4's wording waits in
docs/app-capabilities.md).
Decided so far (section 5): option (a), an app-mode service, now, and
option (b), messages between pages, later; off until the person switches
it on at launch; the sealed wire after aeo, the courier file, a stronger
installer warning with fs, documents or shell, and the same wire beyond the
local machine later. All six are decided: (a) is ready to build. It is
step 3 of the spreadsheet plan (now spraedsheet's
`docs/spreadsheet_demo_done_and_todo.md`):
steps 1 and 2 brought over the Tauri spreadsheet's query functions and its
control functions. That leaves its control bus, which lets another process
drive the app, ARexx-style. Steps 1 and 2 were spreadsheet questions. This
one is a browser-architecture question: today nothing in sae listens for
anything, and that is part of the sandbox.

`docs/architecture.md` (the layers), `docs/page-services.md` (what a page is
handed) and the README's "Browser security rules" and "App capabilities"
are the background.

## 1. What the Tauri app does

From RexxJS/example-app-spreadsheet at `45b0993` (`src-tauri/src/lib.rs`,
`src/spreadsheet-address-handler.js`, `TESTING-CONTROL-BUS.md`):

- `rexxsheet --control-bus` starts an HTTP server (axum) on
  `127.0.0.1:2410` (the port can be changed through an environment
  variable).
- A client sends `POST /api/spreadsheet` with `Authorization: Bearer
  <token>`. The token comes from `CONTROL_BUS_TOKEN` and defaults to
  `dev-token-12345`.
- The Rust side queues each command, and the web view polls for them
  (COMET-style, every 100 ms). The web view runs the command as **REXX
  code** on its interpreter, with the control functions in scope, then
  posts back RESULT and RC.
- A REXX client writes
  `ADDRESS "http://localhost:2410/api/spreadsheet" AUTH "<token>" AS
  SPREADSHEET`, and from then on each quoted string is sent:
  `'SETCELL("A1", "100")'`, then `RC` and `RESULT`.

Demo 18 now runs that client script unchanged but for the ADDRESS line
(`ADDRESS SPREADSHEET`, inside the page: `lower/tests/mod/sheet_control.ts`).
What is missing is the part where the script runs in another process.

The app's bus has weaknesses that sae should not copy:

| In the app | Why it matters |
|---|---|
| A fixed default token (`dev-token-12345`), printed to the log | Anyone who has read the docs can drive any copy started without the variable set |
| `CorsLayer` with `allow_origin(Any)` and any headers | Any web page in any browser on the machine can send the request; only the token stands in the way |
| No `Host` check | DNS rebinding: a web page on `evil.test` re-points its own name at 127.0.0.1, and to the browser the request is same-origin |
| The token compared with `!=` | Timing leaks, slight on loopback, but free to avoid |
| A fixed port | Another process can take the port first and collect the tokens clients send it |
| The payload is code | Here that is less bad than it sounds (below), but it means the bus's reach is "whatever the interpreter can do", not a list |

## 2. The question

A web page in the browser must never accept connections. That is not in
question. The question is whether an **installed app** (`sae --app <dir>`)
may: the installer saw its `app.json`, as they did for `fs`, `shell`,
`http` and `sqlite`.

There are two ways sae could have a bus at all:

- **(a)** An app-mode service. The app declares it in `app.json`, sae
  listens on the local machine, and each request goes to a handler the
  page registered. Another process can drive the app.
- **(b)** Page-to-page messages inside one sae, through `browserContext`.
  This is safe by construction, but no outside process can use it. That
  makes it a different feature (sae apps scripting each other), not the
  ARexx one.

The rest of this note is (a), with its rules first.

## 3. Option (a): `capabilities.controlBus`

### What an app declares, and what a page seeks

```json
"capabilities": {
  "controlBus": { "name": "spreadsheet", "maxRequestBytes": 65536 }
}
```

```ts
"seeks control-bus";
// The request is the string a client's ADDRESS SPREADSHEET sent, given to
// the same code that runs one inside a script (script.ts), never spliced
// into a larger script.
bus.serve(async (request: string) => spreadsheet(request));
```

- `bus` is a page-API object, like `sqlite.<name>`. A page that does not
  seek it does not have it, by any route (`tests/spec_globals.ae` holds the
  global surface to a list).
- `bus.serve(fn)` registers the one handler. A second call replaces it.
  `bus.stop()` stops serving.
- `bus.serve(fn, stopped)`: `stopped(reason)` runs, in an entry of its own,
  when a request was answered as failed without the handler, so the page
  can put back what that request had done. `"interrupted"`: the page's
  time limit stopped the handler (its promise never settles, so nothing
  of the page's own runs after it). `"deadline"`: it was still running
  when the bus answered for it at 10 s (the page may still be at it, and
  should make it fail). Added 2026-10-15, when a REXX request that ran
  past the limit left the spreadsheet's undo group open for good.
- A request is a string, and the handler's answer is a string or a plain
  JSON object. Nothing else crosses: no handles, no functions.

### The rules

Each rule would be enforced in the kernel or in `services/bus`. Each would
have its attempt in the escape corpus (`tests/escape/`, held to "refused,
logged once" by `tests/spec_escape.ae`) and its happy path in a new
`tests/spec_app_bus.ae`. Those are the README's terms for a browser rule
being done.

1. **App mode only, declared and sought.**
   - A web page has no `bus` object.
   - A page that names `bus` without `"seeks control-bus"` is refused when
     it is lowered, as `fs` is.
   - An app whose `app.json` lacks `capabilities.controlBus` refuses a page
     that seeks it, before any of it runs: `seeks control-bus, which this
     app's app.json does not grant`.
2. **Off until the person running it says so** (decision 2).
   - The installer agreed to the app *being able* to listen.
   - Whether it listens is chosen at each launch: `sae --app <dir>
     --control-bus`, as the Tauri app does, or a toggle in the app's window.
   - Without that, `bus.serve` resolves but nothing listens, and the
     console says so once.
3. **The local machine, and a port nobody chose.**
   - sae binds `127.0.0.1` (and `::1`), never `0.0.0.0`.
   - It binds port 0, so the OS picks a free port. That only stops another
     program from taking a known port first; it is not what keeps anyone
     out. The courier key is (rule 4).
   - sae never announces where it is. It writes the address and the key to
     the courier file (rule 4), and a client reads them there: aeo's "the
     contained never self-addresses".
4. **A courier key, delivered by a file, never shown** (after aeo's
   `lib/agent_auth`: the 1970s bank key courier, not PKI).
   - A fresh secret from the OS's generator for each launch, dying with it.
     No default, and nothing to reuse: a key captured once is no good
     against the next launch.
   - Delivered out of band: `$APPDATA/.control-bus` (mode `0600`, replaced
     atomically, deleted on exit) holds the address and the key. The file
     is the courier; the operating system's file permissions say who may
     read it. A client on another account cannot.
   - Never logged, never in argv or the environment, never in the window.
   - Checked in constant time, fail-closed (no key, no access).
5. **Every request and reply sealed** (aeo's `lib/secure_channel`).
   - Each message is one AEAD envelope, `AE1:<nonce>:<ciphertext+tag>`:
     Ascon-AEAD128 (NIST SP 800-232), its key derived by HKDF-SHA256 from
     the courier key, pure Aether. That is confidentiality, integrity and
     authentication **both ways**: a request without the key is refused,
     and a reply from anything that is not this sae (a program that took
     the port after a crash left a stale file) does not open, so a client
     never mistakes it for sae.
   - Anti-replay: each frame carries its time and is refused outside a
     short window (aeo uses 30 s), and its nonce is refused if seen before.
   - No TLS on the local machine: loopback traffic is not readable by
     other users without root, and root can read the courier file anyway.
     What a plain token would lack is the client knowing it reached sae;
     the sealed reply gives that, with no certificate to make or pin.
   - **No browser can reach it, by construction**: a web page has no
     courier key, so it cannot make an `AE1` frame. sae still refuses a
     request carrying an `Origin` header, a `Host` that is not its own
     address (DNS rebinding), and sends no CORS headers: a second line,
     cheap, behind the first.
6. **The bus grants nothing the page does not already have.**
   - The handler runs in the page's own runtime, under its 5 s-per-entry
     and 32 MB caps, with exactly the page's grants.
   - The Tauri app's "the payload is code" becomes, in sae, "the payload is
     whatever the page's handler makes of a string". If demo 18 runs it as
     REXX, that REXX reaches the sheet's commands and nothing else (a
     RexxJS interpreter inside a page has no `fs` or network unless the
     page hands them over).
   - **But**: an app with `fs` and `controlBus` lets another local process
     drive the page's `fs` through whatever the handler allows. So the
     installer's summary of the app must say "other programs you run can
     control this app" beside its other grants (decision 4).
7. **Small and one at a time.**
   - A request body is at most `maxRequestBytes` (default 64 KB, ceiling
     1 MB). Over that, 413, and the body is never read in full.
   - Requests reach the handler one at a time, in order (the http
     pattern: the listener is an Aether actor, and answers come back on the
     UI thread).
   - At most 8 are queued. Past that the request is refused (503), as a
     page's ninth request in flight is.
   - A handler that throws answers `{rc: 1, error: <message>}`. One that
     runs past 5 s in one entry is stopped as any entry is, and its
     request answered at once ("stopped: it ran past the app's limit of
     5 s for one piece of work"); one that has not answered in 10 s (it
     awaits, so no single entry runs long) is answered for it. Either way
     the page is told, through `stopped`.
8. **Seen.**
   - While the bus is listening, the window says so (a marker in the
     title, as an OS marks screen sharing).
   - Each client connection is logged once on the console, with its
     address and nothing more.
9. **Tied to the page that serves.**
   - When the page navigates away, its handler goes with it. Requests then
     get 503 until a new page calls `bus.serve`. They are never queued
     into the next page.
   - The listener lives as long as the app process.
10. **Desktop first.** Android and iOS have their own IPC (intents, URL
    schemes). The bus is refused there until there is a reason to think
    otherwise.

### The wire

HTTP over loopback, every body sealed (rule 5):

- `POST /api/<name>`, its body the envelope of `{"command": "<string>"}`.
- The reply's body the envelope of `{"success": true|false, "result":
  ..., "errorCode": n}`.

These are the Tauri app's JSON shapes, so its client scripts carry over.
**Built (2026-10-14):** `target/sae-bus` (`tools/saebus.ae`): `sae-bus
<app name> <command>` finds the app's courier file, seals the command,
sends it, opens the answer and prints it, one line of JSON; exit status 2
when there is no app to ask, with why on stderr. It is the one client:
shells and other languages run it. RexxJS learns nothing of sae (no sae
code goes into RexxJS): the spreadsheet's repository has an ADDRESS
library, `rexx/spreadsheet-address.js`, whose `ADDRESS SPREADSHEET` runs
`sae-bus` for each command, and its scripts changed only from
`ADDRESS "<url>" AUTH "<token>" AS SPREADSHEET` to that (and where the sae
app differs from the Tauri app; its `rexx/README.md`). Its
`spec_app_sheet_rexx` runs them against the app.

The sealing comes from aeo, which runs it between a host and the agents of
its nested VMs and containers (down to a Pi Zero 2 W with no OpenSSL):
`lib/secure_channel` and `lib/agent_auth`. Rather than a second copy, both
would move into one module that aeo and sae import.

**Beyond the local machine** (not in the first version): the same envelope
works between machines, as it does for aeo's nested agents; what changes is
delivery. The courier key would have to be carried to the other machine out
of band (aeo does it with one ssh at bootstrap), and sae would bind an
address the person names, explicitly. TLS earns its place only if clients
we do not write must connect (curl, any language's HTTP client): then a
self-signed certificate pinned by its fingerprint in the courier file, or a
real certificate for a public name, from Aether's TLS server.

### What building it would touch

Each part follows sae's existing patterns:

- **`services/bus`**: the listener (Aether's `std.http` server, bound to
  loopback on port 0: `server_bind`), the courier key and file, the
  envelope (aeo's `secure_channel` and `agent_auth`, moved into a module
  both import), the request checks of rules 3 to 5 and 7.
  `tests/check_layers.sh` holds it to its imports, and fails if the listen
  call is named anywhere else, as `client.request` is held to
  `services/net`.
- **The gate**: `sae_bus_serve` and `sae_bus_stop` in `src/sae_host.ae`,
  each with the page veto line, registered in `api_register_` for app mode
  only. The handler is held with `hold_()`, and each request is fired
  through `fire0_`-style reporting, which then runs the page's promise jobs.
- **The lowerer and the kernel**: `"seeks control-bus"`, and the app.json
  check.
- **Tests**:
  - the escape corpus: a web page naming `bus`; an app page that does not
    seek it; an app that does not declare it; and, from a test client, an
    unsealed request, one sealed with the wrong key, a replayed frame (the
    same nonce, and one outside the window), an `Origin` header, a wrong
    `Host`, an oversized body, the ninth queued request, and a request
    after the page navigates away; and, from the client's side, a reply
    from a server without the key, which must not open;
  - `spec_app_bus`: a test app with a handler, driven by a small Aether
    client (`tools/busclient.ae`);
  - demo 18: the app's `test-spreadsheet-address.rexx` with its original
    ADDRESS line, run by RexxJS under Node against `sae --app`.
- **Docs**: the README's App capabilities section, `docs/app-capabilities.md`,
  `docs/architecture.md`'s layer table.

## 4. Option (b), for comparison

`browserContext` (every page has it) could carry messages between pages of
one sae: `browserContext.post(name, string)` and
`browserContext.on(name, fn)`. Nothing leaves the process. That gives sae
apps a way to script each other, and it needs no listening socket, no
token and no installer warning. It does not let Node, a terminal or another
program drive an app, which is what the ARexx comparison is about.

## 5. Decisions needed

1. **(a), (b), both, or neither?** **Decided (Paul, 2026-10-14): (a) now,
   (b) later.** (a) with the rules above, because the ARexx use (a shell
   script or a REXX script driving an app) is the point; (b), sae apps
   scripting each other through `browserContext`, follows.
2. **Off until the person opts in at launch?** **Decided (Paul,
   2026-10-14): yes.** Declared by the app, switched on by the person at
   each launch (`--control-bus`, or a window toggle), as a microphone is.
3. **The wire.** **Decided (Paul, 2026-10-14): the sealed wire.** HTTP on
   loopback with every request and reply sealed with the courier key (rule
   5, after aeo), RexxJS's `ADDRESS` taught the envelope, and aeo's
   `secure_channel` and `agent_auth` shared rather than copied. (Weighed and
   not taken: the Tauri app's plain HTTP and bearer token, which proves
   nothing to a client about whom it reached; a Unix socket, a new
   transport for every client.)
4. **The installer's wording.** **Decided (Paul, 2026-10-14): yes, a
   stronger warning for the combination.** An app with `controlBus` is
   listed as "Other programs you run can control this app, while you have
   it switched on". With `fs`, `documents` or `shell` as well, the warning
   says what that adds up to: "Other programs you run could then read and
   write your files (or open links) through this app".
5. **The courier file.** **Decided (Paul, 2026-10-14): yes.**
   `$APPDATA/.control-bus`, readable only by the user, holding the address
   and the key: how a client finds sae and gets its key. (Not a key copied
   out of the window: clumsier, and the key on screen.)
6. **Beyond the local machine, later.** **Decided (Paul, 2026-10-14):
   yes.** The same sealed wire, the key carried to the other machine out of
   band (as aeo does), sae binding an address the person names; TLS with a
   pinned certificate only if clients we do not write must connect.

## The ui channel (2026-10-18)

An app that wants an outside program to look at its window and press its
keys declares it by name: `"controlBus": { "name": "sheet", "ui": true }` in
app.json (the installer saw it, as for the bus itself). With `--control-bus`
at launch and in a sae-driver build (aether-ui's driver on, started with
`AETHER_UI_TEST_PORT`), a request that begins `@ui ` is not given to the
page: sae passes it to the app's own UI driver, on this machine, and answers
with what the driver says.

```
sae-bus Spreadsheet '@ui GET /widgets'                  every widget: text, geometry, state
sae-bus Spreadsheet '@ui GET /screenshot?b64=1'         the window, a PNG as base64 text
sae-bus Spreadsheet '@ui POST /window/key?combo=Down'   a key, as a person presses it
sae-bus Spreadsheet '@ui POST /widget/12/click'         a widget clicked
sae-bus Spreadsheet '@ui POST /focus/move?dir=forward'  the focus moved on as Tab moves it (dir=backward: Shift+Tab); says what has it now
```

Only a short list of paths is passed (what a person at the window can do:
`GET /widgets`, `/widget/<id>`, `/focus`, `/window/pick`, `/screenshot?b64=1`;
`POST /window/key`, `/window/resize`, `/focus/move` and `/widget/<id>/` `click`, `set_text`,
`focus`, `hover`, `toggle`, `set_value`); anything else, a path climbing out,
another method, is refused and says so. Without the grant the request is
refused (`this app's app.json does not grant capabilities.controlBus.ui`);
without a driver (a release sae) it says there is none. The driver answers on
the UI thread, so the connection is read a tick at a time, never waited on.
The spreadsheet grants it, and its MCP server offers `spreadsheet_screenshot`,
`spreadsheet_key` and `spreadsheet_ui` over it. `tests/spec_app_bus_ui.ae`,
`tests/spec_app_bus.ae` (the refusal without the grant).
