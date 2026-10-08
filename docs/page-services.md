# Page services: what a page is handed, and what it could be

A design note for Paul and Nic. Sections 1 and 2 describe what sae does
today, and section 4 (timers) is built. Sections 5 (files) and 6 (SQLite)
are agreed designs, not built yet; sections 3, 7, 8 and 9 are proposals and
open questions, not specs.
`docs/architecture.md` has the layers, and `docs/app-capabilities.md` has
the grants and seeks as built.

Terms used throughout:

- **Origin**: the scheme, host and port of a URL, such as
  `https://api.github.com:443`. Browsers treat everything from one origin as
  one party.
- **Ambient authority**: power a piece of code has just by running, without
  anyone handing it over. A script in a web page can call `fetch` or open a
  `WebSocket` because those are simply *there*. sae aims for none.
- **Capability**: an object that is both the permission and the means. If a
  page holds the `fs` object it can use files, within limits; if it does not,
  there is no other route to files.

## 1. The model: sae as an IoC container

In inversion of control (IoC), code does not reach out for what it needs: it
is handed it. sae runs every page that way. Each page gets a fresh QuickJS
runtime with nothing but the language in it, and `api_register_` in
`src/sae_host.ae` then installs the objects that page may use. A page can
reach only those objects. There is no global `fetch`, no module loader and
no file access to fall back on (section 2).

### Two lifetimes

| Scope | Services | Lives as long as |
|---|---|---|
| **App** (or browser process) | `http` (a pool of `HttpFetcher` actors and one `HttpInbox`, shared by every page), `storage` (one folder per installed app, origin or file folder), `fs` (`services/files`, configured from app.json), `shell` (`services/shell`), the network allowlist (`services/net`) | the process |
| **Page** | the runtime itself, `ui` (the page's widget subtree and handle stack), `vg` (its scene nodes), timers and animation frames (`ui.timer`/`after`/`sleep`/`frame`, `setTimeout` and the other web names), `browserContext`, `print`, `performance`, its pending http callbacks | one page load: leaving the page disposes the runtime, cancels its timers and frames and drops replies still in flight (`page_free_`) |

A page-scoped object never outlives its page, and a handle (a widget, vg
node or timer id) is checked against the page that made it before it is
used. A page cannot reach another page's runtime or handles.

### Capabilities as declared dependencies

An app declares in `app.json` what it may ever have (the **grants**):

```json
"capabilities": {
  "http":  ["https://api.github.com/"],
  "shell": { "open": ["https://github.com/"] },
  "fs":    { "read": ["$DOCUMENTS/notes/"], "write": ["$APPDATA/"] }
}
```

`capabilities.http` is also the app's whole network: an app without it has
none. A web page in the browser has fixed grants: its own origin for http
(and any origin that consents to it with `Sae-Allow-Origin`),
nothing else.

### Seeks: what each page asks for

Each page declares what *it* needs in its first lines, which is
dependency injection in the IoC sense:

```ts
"seeks outgoing-http GET https://api.github.com/notifications/*";
"seeks local-filesystem, reduced functionality without";
```

The page gets the intersection of what it seeks and what the context grants,
checked three times:

1. The lowerer refuses a page that names `http`, `fs` or `shell` without
   seeking it.
2. The kernel refuses, before any of it runs, a page whose required seeks are
   not granted.
3. Every call is held to the grants and scopes.

**The `unsought_()` fix.** Rule 1 checks names only, so until recently a
page that sought nothing could still reach `globalThis["ht" + "tp"]`, with
the app's full grant. `load_` now leaves out the object for any privilege the
page does not seek, so an unsought service is *absent*, not merely unnamed.
`tests/spec_globals.ae` holds this in both modes.

## 2. The global surface a page sees

From the audit (quickjs-ng 0.17.0 as `contrib.quickjs` builds it, without
quickjs-libc). `tests/spec_globals.ae` pins this exact list. A new global,
from an engine bump or a new page API, fails that spec until someone adds it
on purpose.

**From the engine, every page:**

- Language core: `Object Function Array Number Boolean String Symbol BigInt
  Date RegExp JSON Math Reflect Proxy Promise Iterator globalThis Infinity
  NaN undefined eval parseInt parseFloat isNaN isFinite encodeURI
  encodeURIComponent decodeURI decodeURIComponent escape unescape`.
- Errors: `Error EvalError RangeError ReferenceError SyntaxError TypeError
  URIError InternalError AggregateError SuppressedError`.
- Collections and memory: `Map Set WeakMap WeakSet WeakRef
  FinalizationRegistry DisposableStack AsyncDisposableStack`.
- Binary: `ArrayBuffer SharedArrayBuffer DataView Atomics`, plus the typed
  arrays: `Int8/16/32Array`, `Uint8/16/32Array`, `Uint8ClampedArray`,
  `BigInt64Array`, `BigUint64Array`, `Float16/32/64Array`.
- Scheduling: `queueMicrotask`.
- quickjs-ng extras: `DOMException btoa atob`, plus `Error.captureStackTrace`
  and a settable `Error.prepareStackTrace`.
- `Object.prototype`: the usual methods, plus `__proto__` and
  `__define/lookupGetter/Setter__`.

**From sae, every page:** `ui vg storage browserContext print performance`,
and the timer names `setTimeout setInterval clearTimeout clearInterval
requestAnimationFrame cancelAnimationFrame` (section 4). They are page-scoped
services, so they need no capability grant.

**From sae, only when sought and granted:** `http` (browser: own origin, and
other origins with their consent, the CORS-alike; app: `capabilities.http`),
and in an app `fs` and `shell`.

**Checked and absent:**

- No `fetch`, `XMLHttpRequest`, `WebSocket`, `require`, `std`, `os` or
  `scriptArgs` (the timer names are sae's own, above, not quickjs-libc's).
- `import()` of any specifier, whether a path, a `data:` URL or `http:`,
  rejects: no module loader is installed for it, still. **Static `import`**
  is how a page gets code (README "Modules"): the lowerer rewrites it into
  a call on `$sae`, a loader object handed to the page's wrapper function
  (not a global: the global surface above is unchanged), and the host
  resolves and runs the import closure before the page, from the page's own
  origin (browser), its bundle (app) or its folder (a file), or `sae:`, the
  library sae carries, hashed; `$sae.m` returns only what was imported
  statically, so a page cannot reach code it did not name at the top.
- `Atomics.wait` throws ("cannot block in this thread").
- `eval` and `Function` stay in the page's own realm.
- A host function's `.constructor` is just `Function`, it has no
  `prototype`, and `.caller` throws.
- Stack-trace call sites show only the page's own functions.

**Open policy questions:**

- **Time and randomness.** `Math.random`, `Date`/`Date.now` and
  `performance.now` grant no authority, but they are nondeterministic and
  can be used to time things. Do we care, for reproducible specs or for
  timing side channels? `SAE_TIME_SCALE` already intercepts the clocks.
  Partly answered (roadmap decision 1, behind a switch): `performance.now`
  and frame timestamps are coarse (100 us) in the browser and full
  resolution in an app, `SAE_COARSE_CLOCKS` overriding either.
- **Memory and GC.** `SharedArrayBuffer`/`Atomics` are harmless with one
  thread per runtime, but would matter with workers (section 7).
  `WeakRef`/`FinalizationRegistry` make garbage collection observable.
  Keep, or ask contrib.quickjs for a way to leave intrinsics out?
- **quickjs-ng extras.** Do `btoa`, `atob`, `DOMException`,
  `Error.captureStackTrace` and the `prepareStackTrace` hook belong in the
  allowed list (they are pure and same-realm), or should they go?

## 3. quickjs-libc, item by item

quickjs-ng 0.17.0's `quickjs-libc` (in the amalgamation behind
`QJS_BUILD_LIBC`, which contrib.quickjs never defines) is what a `qjs`
script gets. Its `std` module has `exit`, `gc`, `evalScript`, `loadScript`,
`getenv`, `setenv`, `unsetenv`, `getenviron`, `urlGet`, `loadFile`,
`writeFile`, `strerror`, `open`, `popen`, `tmpfile`, `fdopen`, `puts`,
`printf`, `sprintf`, and FILE objects with read/write/seek/getline. Its `os`
module has `open`, `close`, `seek`, `read`, `write`, `isatty`,
`ttyGetWinSize`, `ttySetRaw`, `remove`, `rename`, `setReadHandler`,
`setWriteHandler`, `signal`, `cputime`, `exePath`, `now`, `setTimeout`,
`setInterval`, `clearTimeout`, `clearInterval`, `sleepAsync`, `sleep`,
`platform`, `getcwd`, `chdir`, `mkdir`, `readdir`, `mkdtemp`, `mkstemp`,
`stat`, `lstat`, `utimes`, `realpath`, `symlink`, `readlink`, `exec`,
`getpid`, `waitpid`, `pipe`, `kill`, `dup`, `dup2` and `Worker`. Its helpers
add `console.log`, `print` and `scriptArgs`, and it installs a module loader
that reads files and `.so` native modules. `bjson` adds binary JSON.

| libc area | What sae offers today | Proposal |
|---|---|---|
| `console`/`print`/`performance` | `print`, `performance.now` | Replicate `console.log/warn/error` as aliases of `print`, for familiarity. Harmless. |
| Timers (`os.setTimeout` and friends, `sleepAsync`) | `ui.timer`, `ui.after`, `ui.sleep`, `ui.frame`, and the web names as globals (section 4) | Done: replicated, page-scoped (section 4). |
| Files (`std.open`/`loadFile`/`writeFile`, `os.open/read/write/readdir/stat/mkdir/remove/rename/realpath/symlink`) | app-mode `fs` within app.json's directory grants | Replicate only as capabilities: declared base folders and a powerbox replace raw-path `fs` (section 5). Never raw fds, `symlink`, `chdir` or `getcwd`. |
| Processes (`os.exec`, `std.popen`, `waitpid`, `kill`, `signal`, `getpid`) | nothing | Deliberately not. If an app ever needs a helper process, it would be one named command per app.json grant, run by a service with fixed arguments, not a shell. |
| Environment (`getenv`/`setenv`/`getenviron`), `scriptArgs`, `exePath`, `platform` | nothing (the kernel reads its own environment) | Deliberately not. A page that needs to know the platform could get a read-only `ui.backend_name()`-style value. |
| Network (`std.urlGet`, which shells out to curl) | `http` (actors, allowlisted, redirects checked per hop) | Already replaced, in capability form. |
| `Worker` | nothing | As Aether actors, capability-passing (section 7). |
| Raw fd, tty, pipe (`dup`, `pipe`, `ttySetRaw`, `isatty`, `setReadHandler`) | nothing | Deliberately not: there is no terminal, and fds are ambient. |
| Module loader, `evalScript`, `loadScript` | nothing: pages are single scripts, and `import()` rejects | Not as a file loader. If pages want modules, a loader that resolves only within the page's own origin or app bundle, through the same fetch as pages, so it is held to the same rules. |
| `exit`, `gc` | nothing | Deliberately not. A page cannot end the process; an app's own "quit" would be a `ui`-level capability. |

## 4. Timers

**Built** (2026-10-08). Every timer a page starts is an entry in that page's
own queue (`PageTimer` in `src/sae_host.ae`, "the page API: timers"), run
by one aether-ui one-shot (`ui.timer_once`) armed for its earliest due time;
animation frames are a second per-page list, run by an aether-ui frame
subscription (`ui.on_frame`) held only while callbacks wait. Both go when the
page goes. `tests/spec_timers.ae` (pages `site/timers.ts`,
`site/timers_away.ts`) covers each item below.

| Page API | What it does |
|---|---|
| `ui.timer(ms, fn)` | repeats every `ms` (at least 10, as before) until cancelled |
| `ui.after(ms, fn)` | **one-shot**: runs `fn` once, `ms` from now |
| `ui.sleep(ms)` | **promise** that resolves after `ms`; never settles if the page goes first |
| `ui.timer_cancel(id)` | cancels any of the page's timers |
| `ui.frame(fn)`, `ui.frame_cancel(id)` | **animation frame**: `fn(timestamp)` once, on the next display frame |
| `setTimeout(fn, ms, ...args)`, `setInterval(fn, ms, ...args)`, `clearTimeout(id)`, `clearInterval(id)` | **standard names** for the same queue, as globals |
| `requestAnimationFrame(fn)`, `cancelAnimationFrame(id)` | standard names for `ui.frame` / `ui.frame_cancel` |

What each guarantees:

- **Exactly once.** A one-shot (`after`, `setTimeout`, `sleep`) leaves the
  queue before its callback runs, so it runs once even when the callback is
  slower than its delay or throws (the error is reported, as a handler's
  is). The proposal here was a repeating aether-ui timer that cancels
  itself on its first tick; the queue does better (one native timer per
  page, HTML's ordering), and aether-ui gained a real one-shot,
  `ui.timer_once`, for it, implemented once above the ABI so it is the same
  on every backend.
- **Order and clamping, as HTML.** Due time first, then the order the timers
  were set. A negative, `NaN` or overflowing delay is 0; at a nesting level
  above 5 (a timer set from a timer callback, five deep, or an interval past
  its fifth run) a delay under 4 ms is 4 ms. `ui.timer` keeps its 10 ms
  floor, so the earlier answer to "10 ms differs from browsers" is that the
  web names follow browsers and `ui.timer` stays as it was. A timer set
  while the queue runs waits for the next turn, so `setTimeout(f, 0)` chains
  cannot starve the event loop. Intervals reschedule from now before their
  callback runs, so a slow one drifts rather than bursting.
- **Arguments.** `setTimeout`/`setInterval` pass extra arguments. A string
  handler is a `TypeError`: sae does not `eval` timer strings.
- **Ids.** One id space per page, shared by every kind: `clearTimeout`
  cancels a `setInterval` and `timer_cancel` a `setTimeout`, as in a browser.
  An id from another page names nothing.
- **Animation frames.** `frame` is one-shot per call; a callback that asks
  again runs in the next frame. Every callback in one frame gets the same
  timestamp, in fractional milliseconds on `performance.now()`'s clock
  (scaled with it under `SAE_TIME_SCALE`). The display clock is aether-ui's
  `ui.on_frame` (`aether-ui/README.md`, "Timers and the frame clock"):
  GTK4's frame clock, `CADisplayLink` on macOS 14+ and iOS (`CVDisplayLink`
  on older macOS), Android's Choreographer, `DwmFlush` on a helper thread on
  Windows. Where the display stops delivering (a hidden or backgrounded
  window, a sleeping display, a Windows session with no compositor), a timer
  at the display's rate stands in, so frames throttle but do not stop;
  `ui.frame_source()` in aether-ui names the clock in use.
- **Page-scoped, so no grant.** Leaving the page cancels its wake and its
  frame subscription and drops every queued callback; a pending `sleep`
  promise goes with the runtime. A timer cannot outlive or reach past its
  page, which is why these need no capability and why the standard names are
  in every page (and on `tests/spec_globals.ae`'s list).
- **Time scale.** `SAE_TIME_SCALE` speeds up the clocks a page reads, not
  its timers.

## 5. Files: declared bases and a powerbox (agreed design, app mode)

**Status: agreed with Paul on 2026-10-08; not built yet.** This replaces
today's raw-path `fs` in app mode. Browser-mode pages get no file access at
all. A **powerbox** is a system dialog the *user* drives: the page asks "let
the user pick", the user picks, and the page gets a handle to what was
picked. That is how Android's Storage Access Framework, the macOS sandbox and
browsers' File System Access API already work.

1. **app.json declares named base folders; pages use paths relative to
   them.**

   ```json
   "capabilities": { "files": { "notes": "$DOCUMENTS/MyNotes" } }
   ```

   ```ts
   const text = await files.notes.read_text("2026/today.md");
   ```

   A page names a declared base and a path inside it, never an absolute
   path. The files service resolves the real path, takes out `.`/`..`
   (including encoded forms, as `capabilities.http` does), resolves
   symlinks, and refuses anything that lands outside the base. A page seeks
   `files.notes` the same way it seeks `outgoing-http`; an unsought base is
   absent (the `unsought_()` rule).
2. **Picking inside a base is normal and needs no warning.** The picker
   opens at the base; whatever the user picks inside it comes back as a
   handle (`read_text`, `read_bytes`, `write_text`, `name`, `size`; plus
   `list`, `get_file`, `get_directory`, `create`, `remove` on a folder
   handle), held to the same containment rules.
3. **Picking outside every base is the elevated case, warned after the
   pick.** No platform's dialog can fence the user into a folder (each treats
   the start folder as a hint), so sae checks the result. A pick outside
   every declared base gets sae's own dialog:

   > *MyNotes normally works in Documents/MyNotes. You picked
   > Desktop/report.pdf, outside it.* **Allow once** / **Always allow this
   > folder** / **Cancel**

   "Always allow" adds the location to the app's persisted grants, so the
   warning comes once.
4. **Persisted grants, per app.** Grants survive relaunch, stored by sae in
   the app's own data folder (keyed per installed app, like storage), as the
   platform's token where it has one, not a raw path. The user can see and
   revoke them from a per-app "Folder access" screen.
5. **Sandboxed platforms need a first-run pick of each base.** On iOS,
   Android (outside the app's private folder) and a Mac App Store build, the
   OS will not let an app touch `$DOCUMENTS/MyNotes` until the user has
   picked it once. There a declared base becomes a first-run step ("Choose
   where MyNotes keeps its notes"), opened at the suggested location; the
   pick is persisted as the OS-level grant: a security-scoped bookmark on
   macOS and iOS, a persistable tree URI (`takePersistableUriPermission`) on
   Android. From then on it behaves as on the desktop. On GTK, Win32 and a
   non-App-Store Mac build the base is usable straight away.
6. **The app's own private data folder** (`$APPDATA`) is always available,
   with no declaration and no pick.

**Platform pieces aether-ui needs** (all five backends, real, no stubs):
asynchronous `pick_open` / `pick_save` / `pick_directory` that accept a start
folder and return a platform token plus a display name; open/read/write by
token; persisting and restoring a token. Per platform:

- **Android:** the Storage Access Framework (`ACTION_OPEN_DOCUMENT`,
  `ACTION_CREATE_DOCUMENT`, `ACTION_OPEN_DOCUMENT_TREE` with
  `EXTRA_INITIAL_URI`); aether-ui's Android backend already uses SAF with
  persistable URI permissions.
- **iOS:** `UIDocumentPickerViewController` plus security-scoped bookmarks.
  **aether-ui's UIKit pickers are a stub today** (they return "" outside
  headless mode, because iOS pickers are asynchronous and the current picker
  ABI is synchronous; `asks/ios-ipados-libaether-and-appstore.md`). This is
  the first piece to build.
- **macOS:** `NSOpenPanel`/`NSSavePanel` with `directoryURL`; for an App
  Store build, security-scoped bookmarks and the
  `com.apple.security.files.user-selected.read-write` and
  `.bookmarks.app-scope` entitlements.
- **GTK:** `GtkFileDialog` (GTK 4.10+), which goes through the
  xdg-desktop-portal FileChooser when present (Flatpak-friendly).
- **Win32:** `IFileOpenDialog`/`IFileSaveDialog` with `SetFolder`; no OS
  grant tokens, so a persisted grant is the path.

Open details: whether symlinks inside a base that point out of it are
refused (the safe default) or followed; the exact wording and look of the
outside-the-base dialog; and what the "Folder access" screen looks like.

## 6. SQLite databases (agreed design, app mode)

**Status: agreed with Paul on 2026-10-08; version 1 built on 2026-10-08
(branch wave1/sqlite).** What is built: `capabilities.sqlite` with
`migrations`; `"seeks database <name>"` in the lowerer; `sqlite.<name>`
with `all`/`get`/`run`/`transaction` on one `SqliteWorker` actor per
database (`src/sae_host.ae`, the `wave1/sqlite` section); the engine in
`services/sqlite` (held by `tests/check_layers.sh` to importing
`contrib.sqlite` alone); migrations applied once and recorded in
`_sae_migrations`, a failing one refusing the app; the escape routes off in
the engine (an authorizer written in Aether and handed to
`sqlite3_set_authorizer` as a typed function pointer, `SQLITE_LIMIT_ATTACHED`
0, extension loading off), which also costs a plain `VACUUM` in this
version. `contrib.sqlite` exposes none of those calls, nor column names
and types, so the service declares its own externs against libsqlite3
(`asks/sqlite-authorizer.md`). Specs: `tests/spec_sqlite_service.ae` (the
service, no window), `tests/spec_app_sqlite.ae` on `tests/apps/sqlite_demo`
(pages, the escapes, two pages on one actor), `tests/check_sqlite_relaunch.sh`
(migrations once across a relaunch; the refused app). Versions 2 and 3
below are not built; an app.json naming `bundled` or `readonly` is refused
at start saying so. The
container creates, prepares and hands in a database; the page never deals
with files. aether's `contrib.sqlite` is the engine (it already builds for
Android: LisMusic).

```json
"capabilities": {
  "sqlite": {
    "fred":  { "migrations": ["db/001_init.sql", "db/002_tags.sql"] },
    "atlas": { "bundled": "data/atlas.db", "readonly": true }
  }
}
```

```ts
const rows = await sqlite.fred.all("select * from notes where tag = ?", [tag]);
const one  = await sqlite.fred.get("select * from notes where id = ?", [id]);
const r    = await sqlite.fred.run("insert into notes(body) values (?)", [text]); // r.changes, r.lastId
await sqlite.fred.transaction(async tx => { await tx.run(/* ... */); });
```

- **The name is the handle.** `fred` is all a page sees; sae decides where
  the file lives (the app's private data folder, keyed per installed app).
  Pages seek `sqlite.fred`; an unsought database is absent.
- **`all` / `get` / `run`**, with values always passed as `?` parameters
  (the defence against SQL injection).
- **One Aether actor per database,** off the UI thread, so a slow query
  never freezes the window; every call returns a promise.
- **Migrations are the container's job.** On open, sae applies, in order,
  the listed scripts the database has not seen yet (recorded in the
  database), before any page runs, so a page always gets the current schema.
- **Escape routes switched off.** SQLite can reach beyond its own file:
  `ATTACH DATABASE '/any/path'`, `load_extension`, `VACUUM INTO '/path'`.
  sae disables them with an authorizer callback, `SQLITE_LIMIT_ATTACHED` 0
  for pages, and extension loading off, so `fred` is exactly one database
  file and no more.

**Build order** (independent of the files work):

1. **Version 1: app-owned, writable databases with migrations.** Small
   starter data is just `INSERT`s in a migration.
2. **Version 2: bundled, read-only reference databases** (`"bundled"`,
   `"readonly": true`): a finished `.db` shipped in the app, updated only by
   app updates. Opened read-only with SQLite's `immutable=1` on iOS and
   macOS, where the bundle is read-only; on Android copied out of the APK
   (an APK is a zip) and refreshed whenever the app's version changes,
   avoiding the common stale-copy bug. The container may attach it
   read-only into an app-owned database under a fixed name, so a page can
   join (`select ... from atlas.places join saved ...`) without ever naming
   a file.
3. **Version 3: large seeds,** done as a migration that copies from the
   attached reference database (`INSERT INTO x SELECT ... FROM atlas.x`),
   so there is no separate mechanism.

Never: a database downloaded at run time presented as "bundled"; that is
network data and goes through `capabilities.http`.

## 7. Workers as Aether actors

A page could start a worker, a second QuickJS runtime on an Aether actor, to
do heavy work off the UI thread. In keeping with the model, a worker gets
**nothing by default**: only the language, plus whatever capabilities the
page passes it explicitly (`spawn_worker(src, { http })`). Each passed
capability is a handle the worker's runtime receives, and it can be no
wider than the page's own. Messages are copied (structured clone or JSON);
there is no shared memory, so `SharedArrayBuffer` stays single-threaded.
The worker dies with its page. Questions:

- Where does the worker's code come from: the page's own origin or bundle,
  fetched like a page?
- Its CPU and memory caps.
- Whether `ui`/`vg` can ever be passed. Probably not, since widgets belong
  to the UI thread.

## 8. Other candidate services

Each would be a new privilege, granted in app.json, sought by a page, and
held in its own service (`services/<name>`, confined by its imports):

- **Clipboard.** `clipboard.read_text()` and `write_text()`. aether-ui has
  `clipboard_read`/`clipboard_write`. Reading is the sensitive half
  (passwords pass through clipboards), so a separate `clipboard-read` seek,
  or read only during a user gesture?
- **Notifications.** `notify(title, body)`. aether-ui has `notify`,
  `notify_full` and `notify_request_permission`, and Android APKs already
  request `POST_NOTIFICATIONS`. Should the APK request that permission only
  when app.json grants notifications, as INTERNET now follows
  `capabilities.http`?

## 9. The App Store angle

*To be checked against the current App Store Review Guidelines text before
relying on it.*

- **Bundled pages are fine.** Pages shipped inside the app and run by sae's
  own engine should be fine: QuickJS is an interpreter, not a JIT, so it
  needs no executable-memory entitlement.
- **Remote code is the problem.** Pages fetched from the network that
  change the app's behaviour run into guideline 2.5.2 (apps may not
  download code that changes features) and 4.7 / 4.7.2 (HTML5 mini apps and
  games, and the limits on exposing native APIs to them). An app should
  keep its pages in the bundle and use the network for data.
- **General browsing is separate.** sae's browser mode, as a general web
  browser, falls under 2.5.6, which requires WebKit for browsing on iOS,
  except under the EU (and Japan) alternative-browser-engine provisions with
  BrowserEngineKit, which carry their own entitlement and requirements.
