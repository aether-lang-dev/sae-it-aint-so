# Sae it ain't so

A this-fat-UI browser. It fetches **pages** and renders them as real native
widgets or vector graphics, where a page is a small program (layout plus the logic behind it),
not markup. [Tsyne](https://github.com/tsyne/tsyne)-alike: this is [Tsyne's browser](https://github.com/tsyne/tsyne/blob/main/core/src/browser.ts) mode rebuilt on the Aether
stack, as proposed in `aether-ui/docs/design/tsyne-migrated.md`.

One native binary links three things:

- **QuickJS** ([quickjs-ng](https://github.com/quickjs-ng/quickjs)), through
  Aether's `contrib.quickjs`. Each page gets its own runtime, with a memory
  cap (32 MB) and a time limit on every entry into its JS (5 s), so a page
  that loops forever is stopped, not the browser. (sae began on mquickjs-ae,
  the Aether port of MicroQuickJS, and moved for modern JavaScript and those
  limits.)
- **aether-ui**: the native widget toolkit (AppKit here; GTK4 and Win32 are
  the same `ui` builders).
- **sae's host** (`src/sae_host.ae`): the browser window and the page API.

No Node, no bridge process, no IPC: a page's `ui.text("x")` is an
in-process call into aether-ui's `ui/module.ae` builders.

## A page

Pages are written in modern TypeScript: what `tsc --erasableSyntaxOnly`
accepts, over ES2023 (classes, async/await, destructuring, `?.`, `??`, ...).
The browser erases the types in-process, keeping every line and column, and
QuickJS runs the rest as written. A page is a script (no `import`/`export`),
and decorators are not supported yet; see `lower/README.md` for the dialect.

```ts
interface Link { label: string; href: string }
const { text, btn } = ui;

const links: Link[] = [{ label: "About", href: "/about" }];
text(`You are at ${browserContext.currentUrl}`);
for (const link of links) {
  btn(link.label, () => browserContext.changePage(link.href));
}
```

Plain JavaScript is valid dialect too, and passes through unchanged.
`site/modern.ts` shows a class, an `async` click handler awaiting an http
request, destructuring, `?.` and `??` in one page.

Container builders take their block as the last argument, the way Aether's
trailing block works: `ui.vstack(4, fn)` makes the stack under the current
parent, runs `fn` with the stack as the parent, and pops it again even if
`fn` throws. A stack's or grid's spacing may be left out (`vstack(fn)`,
4 points).

```ts
grid(4, () => {                       // four to a row, filled a row at a time
  equal_cells();                      // every key one size: a keypad
  [..."789+456-123*0C=/"].forEach(key);
});
```

The `ui` object (each builder returns its widget handle):

| | |
|---|---|
| containers | `vstack([spacing,] fn)`, `hstack([spacing,] fn)`, `grid(cols, [spacing,] fn)` (the block's widgets fill it row by row), `scroll(fn)`, `button(label, fn)` (the block styles the button) |
| widgets | `text(s)`, `btn(label, onPress)`, `divider()`, `spacer()`, `textfield(placeholder, onChange(text))` |
| modifiers (inside a block) | `margin(t, r, b, l)`, `bg_color(r, g, b, a)`, `onclick(fn)`, `equal_cells()` (in a grid: one width per column, one height per row, for all) |
| reading and writing | `get_text(h)`, `set_text(h, s)`: synchronous, no `await` |
| rebuilding | `clear(h)` empties a `vstack`/`hstack`/`grid` the page made; `into(h, fn)` builds into it again |
| inputs and indicators | `toggle(label, onChange(on))`, `slider(min, max, initial, onChange(v))`, `picker(onChange(i))` + `picker_add(h, item)`, `progressbar(f)` + `set_progress(h, f)`; `get_`/`set_toggle`, `get_`/`set_slider` |
| styles | `styles(sheet)`, `add_class(h, name)`, `style_id(h, name)`: see below |
| timers | `timer(ms, fn)` returns an id, `timer_cancel(id)`; a page's timers stop when it goes |
| showing | `set_visible(h, on)`: hide a view and keep it (and its timers, vg scenes) alive |
| reactive state | `ui_state(v)`, `ui_set(state, v)`, `text_bound(state, prefix, suffix)` |

A page names only widgets it made: a handle below the page's first widget
(the address bar, the status line, the browser's own content area, a
previous page's widgets) makes `get_text`, `set_text`, `clear` and `into`
throw. Without that, `set_text` on the address bar's handle would let a page
show any URL it liked.

A modifier at a page's top level has nothing to modify (the top of the stack
is the browser's own content area), so it throws, where Aether would refuse
to compile it. `site/calculator.ts` is the design doc's calculator example.
Pages are not given `window()`: the browser owns the window.

### HTTP, on Aether's actor core

```ts
const req = http.get("/api/items", (res) => {
  if (!res.ok) { show(res.error || `HTTP ${res.status}`); return; }
  render(res.json());                      // or res.text
});
http.post("/api/items", JSON.stringify(item), "application/json", (res) => { ... });
req.cancel();                              // its callback will not run
```

`res` is `{ ok, status, text, error, json() }`: `ok` is a 2xx answer,
`status` is 0 when nothing came back, `error` is `""` unless the request
failed or was refused. `http.get` and `http.post` return `{ id, cancel() }`;
a cancelled request may still finish on its actor, but its callback won't run.

A request runs on an Aether actor: a small pool of `HttpFetcher` actors does
the blocking network call on the scheduler's threads, so the page's UI never
waits on it (the spec clicks a button while a slow request is out). Each
finished job goes to an `HttpInbox` actor; while any are in flight, a UI
timer asks the inbox for them and runs the callbacks on the UI thread, where
the JS engine lives. A reply for a page that has since been left is
dropped.

`http.request({ method, url, headers, body, contentType }, (res) => ...)`
takes any method and request headers; `res.headers` holds the response's,
with lowercased names.

Where a page may reach is the kernel's decision, behind the page veto: in
the browser, the page's own origin; in an app, the URL prefixes its
`app.json` grants under `capabilities.http` (below).

Anything else is refused: the callback gets `res.ok` false and the reason in
`res.error`. The request runs on an actor and its answer comes back on the
UI thread, where the callback runs. Or await it: `http.fetch(url)` and
`http.fetch(options)` return a promise of the same response object, from
the same actors, refused the same way (`res.ok` false, never a rejection):

```ts
const res = await http.fetch({ method: "POST", url: "/api/notes", body: json });
if (res.ok) render(res.json());
```

After every handler, timer and http callback sae runs the page's pending
promise jobs, so an `await` carries on as soon as its answer is delivered.

### App capabilities: fs, shell, and what each page may name

An app can be granted what a web page never gets, as narrowly as it can
say it, in `app.json`; the kernel enforces it on every call:

```json
"capabilities": {
  "http":  ["https://api.github.com/"],
  "shell": { "open": ["https://github.com/"] },
  "fs":    { "read": ["$DOCUMENTS/notes/"], "write": ["$APPDATA/"] }
}
```

- `fs.read_text`, `write_text`, `exists`, `list`, `mkdir`, `remove` (and
  Node's `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`):
  synchronous, within the granted folders. Every path is resolved first
  (symlinks, `..`), so it cannot climb out; a refusal throws, naming the
  grant. `$APPDATA` is the app's own folder.
- `shell.open(url)`: hands a URL to the system (the default browser), for
  the granted prefixes.
- A web page has no `fs` and no `shell` at all.

A page says at its top which privileges it seeks, one per line:

```ts
"seeks local-filesystem";   // unlocks fs
"seeks outgoing-http";      // unlocks http
"seeks open-urls";          // unlocks shell.open
```

`ui`, `vg`, `storage` and `browserContext` every page has. A page that
names `fs`, `http` or `shell` without seeking it is refused when it is read
(`page:4:1: fs needs "seeks local-filesystem" at the top of the page`), and
one that seeks what its context does not grant is refused before any of it
runs, saying what is missing (`seeks local-filesystem, which a web page in
the browser cannot have`). A function that starts `"hide fs";` (with every
function inside it) may not name `fs`. `docs/app-capabilities.md` has the
whole design.

### Storage

`storage.get(key)` (a string, or `null`), `storage.set(key, value)` and
`storage.remove(key)`: values that outlive the page and the process, like
`localStorage`. Each app (in app mode) or origin (in the browser) has its
own, under `~/.sae/storage` (`$SAE_STORAGE_DIR` overrides it). Keys are
letters, digits, `.`, `_` and `-`; a value is at most 1 MB. The file system
stays the kernel's: a page reaches only these three calls.

`SAE_TIME_SCALE=<n>` runs the clocks pages see (`Date.now`, `new Date()`,
`performance.now`) n times fast, for specs that wait on timers.

### Styles: a CSS-alike

After Swiby's stylesheets (its banking demo's themes) and Tsyne's
`styles()`, over aether-ui's AeCS cascade:

```ts
ui.styles({
  root:   { font_family: "monospace" },
  label:  { color: 0x5C458A },                  // a kind (Tsyne's names work)
  button: { color: "#5C458A", font_weight: "bold" },
  container: { background_color: 0xD6CFE6 },    // any vstack/hstack
  "header.label": { color: 0x6030BF },          // a class on a kind
  "#balance": { color: "#224488" },             // one widget: style_id(h, "balance")
});
```

Rules apply most specific first: `#id`, then `class.kind`, `class`, kind,
`container`, `root`. Properties: `color`, `background_color`, `font_size`,
`font_weight` / `font_style` (`"bold"` or not), `font_family`, `opacity`,
`border_radius`, `border_width`, `border_color`, `hover_color`,
`active_color`. Colours are `0xRRGGBB`, `"#rrggbb"` or `"#rgb"`. An unknown
property or a malformed colour throws, naming it.

A sheet styles the page's widgets, those already built and those built
after, and never the browser's chrome. Calling `styles()` again restyles the
page in place, which is how `site/banking.ts` switches themes. The sheet is
dropped when the page is left.

### Vector graphics: `vg`

`vg` is aether-ui's AeVG, the Aether port of Tsyne's Cosyne vector graphics
(CVG), in the same shape as `ui`: a scene or shape takes its block as the
last argument, and modifiers inside the block apply to it.

```ts
let circle = 0;
vg.scene("0 0 100 100", 300, 300, () => {
  circle = vg.circle(30, 40, 18, () => {
    vg.fill("#cc4444");
    vg.on_click((x, y) => vg.set_fill(circle, "#33aa33"));
  });
  vg.rect(58, 22, 34, 34, () => { vg.fill("#3366cc"); vg.stroke("#003366", 1); });
  vg.text(55, 90, "AeVG", () => vg.fill("#222"));
});
```

| | |
|---|---|
| scene | `scene(viewBox, w, h, fn)`: a `w` x `h` px canvas under the current `ui` container, drawing the `"x y w h"` viewBox |
| shapes (each returns a handle) | `circle(cx, cy, r, fn?)`, `rect(x, y, w, h, fn?)`, `rrect(x, y, w, h, r, fn?)`, `line(x1, y1, x2, y2, fn?)`, `path(d, fn?)`, `text(x, y, s, fn?)`, `g(fn)` |
| modifiers (inside a shape's block) | `fill(color)`, `stroke(color, width)`, `opacity(v)`, `transform(t)`, `on_click(fn(x, y))` (viewBox coordinates) |
| later, from anywhere | `set_fill(h, color)`, `set_stroke(h, color, width)`, `set_opacity(h, v)`: change a shape and repaint |

Where a Cosyne app writes `c.circle(30, 40, 18).fill("#c44").onClick(f)`, a
sae page writes `vg.circle(30, 40, 18, () => { vg.fill("#c44"); vg.on_click(f) })`.
A shape outside `vg.scene()`, or a modifier outside a shape, throws.
`vg.set_fill`, `set_stroke`, `set_opacity` and `set_text` change a shape
after the scene is built.
`site/vg.ts` is the demo, and `tests/spec_nav.ae` checks its colours
through the driver's canvas pixel route.

A page reaches only what `api_register_` (in `src/sae_host.ae`) installs in
its runtime: the language builtins, `print`, `ui`, `vg`, `http`, `storage`
and `browserContext`, plus `fs` and `shell` in app mode only. QuickJS's
own `std`/`os` modules are not compiled in. There is no `load()`, no file
system and no process access.

Behind that, the host's page-facing functions are walled off from the rest
of the browser (the "kernel": fetching, the file system, the environment,
the lowerer, the engine's parse/run calls). Each one opens with the same
`hide` line (Aether's compile-time `hide`, `aether/docs/hide-and-seal.md`),
so it cannot name `fs`, `os`, `client` or the page-lifecycle functions; what
it needs from the kernel goes through a few named helpers. A file read added
to, say, `vg.set_fill`'s host function is a compile error, at any depth.
`tests/check_page_veto.sh` checks that every page-reachable function has
the line and that the compiler enforces it (nested blocks need Aether with
[aether#2381](https://github.com/aether-lang-dev/aether/pull/2381)). The
list starts with the file system and its neighbours and grows from there;
the end state is `seal except`, an explicit whitelist per function.

The effects a page can ask for live in their own modules,
`services/files` and `services/shell`, each able to reach only its imports:
only `services/shell` can name the system URL opener.
`tests/check_layers.sh` holds each service to its import list.
[docs/architecture.md](docs/architecture.md) has the layers (kernel,
services, gate, page host, guest), how each line is held, and what comes
next.

`browserContext` is Tsyne's: `changePage(url)`, `back()`, `forward()`,
`reload()` and `currentUrl`. A URL resolves against the page that asked
(`/about` is origin-relative). Navigation happens on the next turn of the
event loop, after the page's JS returns, so a click handler can navigate away
from the page its button is on. Leaving a page clears its widget subtree and
frees its context; `tests/spec_nav.ae` checks the widget census stays flat.

Pages come over HTTP (10 s timeout, up to 5 redirects followed) or from a
file. A non-200 page still runs, so a server's own 404 page renders; the
status line under the toolbar shows the status and final URL.

## Build and run

The sibling checkouts are reached through symlinks at the repo root:

| link | points to | why |
|---|---|---|
| `aether-ui` | `../aether-ui` | the toolkit; its `backend/` is compiled into sae |
| `ui` | `aether-ui/ui` | so `import ui` resolves: aetherc looks up imports from the project root |
| `vg` | `aether-ui/vg` | the same for AeVG (`import vg`, `import vg.live`) |

```sh
./build.sh                     # target/build/bin/sae
target/build/bin/sae pages/hello.js
SAE_NO_WINDOW=1 target/build/bin/sae pages/hello.js   # build the page, print timings, exit
```

A development page server maps `/about` to `site/about.js`, serves
`site/404.js` with status 404 for unknown paths, and answers `/old-home` with
a 302:

```sh
(cd tools && ../../aether/build/ae build pageserver.ae -o ../target/pageserver)
target/pageserver site 8090 &
target/build/bin/sae http://127.0.0.1:8090/
```

`./build.sh` uses the Aether tree at `$SAE_AETHER_HOME` (default `../aether`)
and the aeb in `target/toolchain/bin` if present. The engine is that tree's
`contrib/quickjs` (merged in aether#2418, after the 0.774.0 release), whose
QuickJS amalgamation `./build.sh` fetches into the tree if it is missing.

To drive the window over HTTP with the AetherUIDriver:

```sh
AETHER_UI_WITH_DRIVER=1 ./build.sh          # target/build/bin/sae-driver
AETHER_UI_TEST_PORT=9333 target/build/bin/sae-driver pages/hello.js &
curl -s localhost:9333/widgets
curl -s -X POST localhost:9333/widget/9/click
```

The driver build is a separate binary because the control server must not
ship in `sae`.

### App mode: a folder of pages as an installable app

Tauri's model, on sae: the same engine without the browser chrome, the pages
bundled with it. `sae --app <dir>` opens `<dir>` as an app: no address bar,
no Back/Forward/Reload, the window titled and sized from `<dir>/app.json`:

```json
{ "name": "Sae Tasks", "start": "/", "width": 480, "height": 420 }
```

(all optional). Pages are `app:` URLs, mapped like the dev page server maps
a site: `app:/about` is `<dir>/about.ts` (or `.js`), `app:/` the index, a
missing page the app's own `404.ts` if it has one. `browserContext` works as
in the browser, and an app navigates only among its own pages: anything else
is refused and the page stays.

`tools/saepack.sh <dir>` packages it as a macOS `.app` (into `target/apps/`):
sae's binary, the pages under `Contents/Resources/app`, where the binary finds
them and starts in app mode with no arguments, and the non-system dylibs sae
links (Homebrew's OpenSSL, nghttp2, pcre2) copied into `Contents/Frameworks`
with their load paths rewritten, so it runs on a Mac without Homebrew. Signed
ad hoc; not notarized. `apps/tasks` is the small example
(`SAE_TEST_APP=apps/tasks tests/run_spec.sh spec_app` its spec). Two real
apps are ported: `examples/pomatez`, a Pomodoro timer from Electron/Tauri
(7.6 MB packaged), and `examples/gitify`, GitHub notifications from Electron
(7.7 MB), which talks to the GitHub API over sae's actor-backed http and is
specced against a mock GitHub Enterprise API in the page server. Each has a
README saying what is ported and what is not yet.

### Testing pages: saedriver

Tsyne tests pages with `TsyneBrowserTest`; sae's equivalent is
`tests/lib/saedriver.ae`, built on aether-ui's AetherUIDriver client
(`aether-ui/tests/lib/uidriver.ae`). Specs are Aether programs using
`std.spec`, and they drive the browser as a person would: through the
address bar, the chrome's buttons and the page's own widgets.

| Tsyne | saedriver |
|---|---|
| `getTestUrl(path)` | `test_url(path)` |
| `navigate(url)` | `navigate(url)` (address bar, then Go) |
| `back()`, `forward()`, `reload()` | the same, via the chrome's buttons |
| `waitForNavigation()` | `wait_for_url(url)`, `wait_for_page(text, status)` |
| `getCurrentUrl()`, `assertUrl(url)` | `current_url()`, `assert_url(url, msg)` |
| `screenshot(path)` | `screenshot(path)` |
| `addPages`, `createBrowser`, `cleanup` | `tests/run_spec.sh` |

Beyond those: `click(label)`, `set_field(text)`, `has_text`, `assert_text`,
`assert_no_text`, `status_code`, `widget_count` (for leak checks), the vg
canvas (`vg_px_x`/`vg_px_y` map viewBox to pixels, `vg_click`, `vg_pixel`,
`wait_for_vg_pixel`) and the page's console (`wait_for_console`). Waits poll
for up to 3 s; nothing sleeps blind.

```sh
tests/run_spec.sh                 # tests/spec_nav.ae against site/
tests/run_spec.sh my_spec ../my-site
```

The launcher starts `target/pageserver` on the site and `sae-driver` on port
9222 (uidriver's), then runs the spec with both driver modules on
`AETHER_LIB_DIR`. `lower/run-tests.sh` runs the lowerer's tests (needs `target/saelower`).

## Status

Done: the spike (five builders through the context stack, click handlers held
as GC roots, per-phase timings; numbers in `docs/spike-results.md`), HTTP
fetch, history and navigation, browser chrome, the page-dialect lowerer. Not
yet: more of the `ui` surface, the bytecode cache, GTK4/Win32 build arms,
`class` in the dialect.
