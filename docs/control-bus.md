# A control bus: may an installed app accept local connections?

A design note for Paul and Nic to decide on. Nothing here is built. It is
step 3 of the spreadsheet plan (`docs/spreadsheet_demo_done_and_todo.md`):
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
   - It binds port 0, so the OS picks a free port. No fixed port means no
     squatting.
   - It writes the address and the token to a file, `$APPDATA/.control-bus`
     (mode `0600`, replaced atomically, deleted on exit).
   - A client on the same account reads that file. A client on another
     account cannot. That is the whole "who may connect" answer, and it is
     the operating system's.
4. **A token with no default, never shown.**
   - 32 random bytes from the OS's generator for each launch, as hex.
   - It is never logged, never in argv or the environment, and never shown
     in the window. The client reads it from the file.
   - Compared in constant time. A wrong or missing token gets 401 and is
     logged once per connection, without the token.
5. **No browser can reach it.**
   - A request carrying an `Origin` header (only a browser sends one) is
     refused.
   - So is one whose `Host` is not `127.0.0.1:<port>`, `[::1]:<port>` or
     `localhost:<port>`. That closes DNS rebinding.
   - There are no CORS headers at all, so no preflight can succeed.
   - Each of these checks is cheap, and together they mean a web page in
     Chrome or Safari on the same machine gets nowhere even if it guessed
     the port and the token.
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
     runs past 5 s is stopped as any entry is.
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

### The wire, for the RexxJS clients that exist

To keep the app's client scripts working, the wire is the Tauri app's
(decision 3):

- `POST /api/<name>` with `Authorization: Bearer <token>` and the JSON
  body `{"command": "<string>"}`.
- The answer is `{"success": true|false, "result": ..., "errorCode": n}`.

RexxJS's `ADDRESS "<url>" AUTH "<token>" AS SPREADSHEET` then works as it
is, given the URL and the token from the file. A short `sae-bus` wrapper
(or a RexxJS `REQUIRE`d helper) can read the file and write that ADDRESS
line.

A Unix domain socket would be stricter still. File permissions alone would
say who may connect, and no browser could ever send to one, so rule 5
would fall away. But RexxJS's ADDRESS speaks HTTP over TCP, so the app's
clients would need a new transport. The decision is between compatibility
and an even smaller surface. My suggestion is TCP with rules 3 to 5 now,
and the socket as a later option for clients that are not RexxJS.

### What building it would touch

Each part follows sae's existing patterns:

- **`services/bus`**: the listener (Aether's `std.net` server API, which
  needs checking for an ask to aether if it cannot bind loopback-only on
  port 0), the token, the file, the request checks of rules 3 to 5 and 7.
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
    `Origin` header, a wrong `Host`, a wrong token, an oversized body, the
    ninth queued request, and a request after the page navigates away;
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

1. **(a), (b), both, or neither?** My suggestion: (a) with the rules above,
   because the ARexx use (a shell script or a REXX script driving an app)
   is the point. (b) can follow if apps want to talk to each other.
2. **Off until the person opts in at launch?** (`--control-bus`, or a
   window toggle.) My suggestion is yes: declared by the app, switched on
   by the person, as a microphone is.
3. **The wire:** the Tauri app's HTTP and JSON (RexxJS clients unchanged),
   or a Unix socket (smaller, but a new client transport)?
4. **The installer's wording** for an app with `controlBus`, and whether
   `controlBus` together with `fs` or `shell` needs a stronger warning than
   either alone.
5. **The token file**: `$APPDATA/.control-bus`, readable only by the user,
   as the way a client finds the port and the token? (The alternative is a
   token the person copies out of the window, which is clumsier and puts
   the token on screen.)
