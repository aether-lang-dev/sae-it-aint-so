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
QuickJS runs the rest as written. A page may `import` from its own origin
and from the `sae:` library (Modules, below); decorators are not supported
yet; see `lower/README.md` for the dialect.

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
| timers | `timer(ms, fn)` repeats, `after(ms, fn)` runs once, both return an id for `timer_cancel(id)`; `sleep(ms)` is a promise; `frame(fn)` runs `fn(timestamp)` on the next display frame, `frame_cancel(id)`; see Timers below |
| showing | `set_visible(h, on)`: hide a view and keep it (and its timers, vg scenes) alive |
| reactive state | `state(v)`, `computed(fn, ...states)`, `bind(widget, state)`, `` bind`...${s}...` ``, `bind_enabled`, `bind_hidden`, `each(list, key, render)`, `batch(fn)` (globals too: see Reactive state below); the cell-level `ui_state(v)`, `ui_set(state, v)`, `text_bound(state, prefix, suffix)` still work |
| enabling | `set_enabled(h, on)`: grey a widget out, or back |
| keyboard | `on_key(fn(key, mods))`: every key while the page has the focus (names as `"Left"`, `"Return"`, `"BackSpace"`, `"a"`; mods 1 shift, 2 ctrl, 4 alt, 8 super), never a key typed into the browser's chrome; `on_submit(field, fn(text))`: Return in a text field; `focus(h)` |
| text and size | `text_wrapped(s, px)`: a label that wraps its words at `px`; `width(h)`, `height(h)`: a widget's laid-out size in px |

An app's databases (`"seeks database <name>"`; App mode below), every call a promise, run on an actor off the UI thread:

| | |
|---|---|
| `sqlite.<name>` | `all(sql, params?)` the rows as objects, `get(sql, params?)` the first or `null`, `run(sql, params?)` → `{ changes, lastId }`; `params` an array for `?` or an object for `$name` (a number, string, boolean or null each) |
| transactions | `transaction(async tx => { ... })`: `BEGIN`, the callback with `tx.all/get/run`, `COMMIT`, or `ROLLBACK` if it throws; resolves to the callback's value |

A page names only widgets it made: a handle below the page's first widget
(the address bar, the status line, the browser's own content area, a
previous page's widgets) makes `get_text`, `set_text`, `clear` and `into`
throw. Without that, `set_text` on the address bar's handle would let a page
show any URL it liked.

A modifier at a page's top level has nothing to modify (the top of the stack
is the browser's own content area), so it throws, where Aether would refuse
to compile it. `site/calculator.ts` is the design doc's calculator example.
Pages are not given `window()`: the browser owns the window.

### Reactive state: declare once, never call `set_text` again

```ts
const count = state(0);
const name = state("");
const greeting = computed(() => (name.value ? `Hello, ${name.value}` : "Hello, stranger"), name);
bind(text(""), count);                          // a label follows a state
bind(textfield("Your name", () => {}), name);   // a field and a string state, both ways
bind`Count: ${count} of ${total}`;              // the tagged template: a multi-state label
bind_enabled(goButton, busy, true);             // greyed while busy (true inverts)
bind_hidden(spinner, busy, true);               // shown while busy
each(todos, "id", (t, i) => text(`${i + 1}. ${t.title}`));   // keyed rows
batch(() => { first.set("Ada"); last.set("Lovelace"); });    // observers run once, at the end
count.set(count.value + 1);                     // or count.update(n => n + 1)
```

`state`, `computed`, `bind`, `bind_enabled`, `bind_hidden`, `each` and
`batch` are globals in every page (and on `ui`). They are **page-scoped**:
the cells, observers and bindings belong to the page's widgets and go with
them, so they need no capability. They map onto aether-ui's reactive
layer: a number, string or boolean state is one of its typed cells
(`ui_state`, `ui_state_s`, `ui_state_b`), so `bind` is its `bind_text` (and
`bind_value`, two-way, for a text field and a string state), and
`state.h` is the raw cell that `ui_set` and `text_bound` take; any other
value (an array, an object) is kept by the page and the cell counts its
versions, so observers still fire. `computed` is `computed_s` (one observer
per pair of inputs), `batch` is `ui_batch`. `each` keys its rows: a row
whose key stays is kept, and re-rendered only when its item is another
object or its index moved; a gone key's row is removed; new keys append;
a reorder rebuilds the column. A state set also re-evaluates the page's vg
bindings (below), once per batch. The JavaScript is `src/sae_prelude.js`,
embedded by `tools/embed-prelude.sh` (`tests/check_prelude.sh` keeps the
two in step). `site/reactive.ts` is the demo, `tests/spec_reactive.ae`
the spec.

### Timers and animation frames

```ts
ui.after(500, () => hint.hide());           // once; ui.timer(ms, fn) repeats
await ui.sleep(200);                         // a promise
const id = setTimeout((a, b) => go(a, b), 100, "x", 2);
clearTimeout(id);
const tick = (ts: number) => { draw(ts); requestAnimationFrame(tick); };
requestAnimationFrame(tick);                 // or ui.frame(tick)
```

Every page also has the web's names as globals: `setTimeout`,
`setInterval`, `clearTimeout`, `clearInterval`, `requestAnimationFrame` and
`cancelAnimationFrame`. They are sae's, not quickjs-libc's, and they are
**page-scoped services**: one queue per page, holding only that page's
timers, cancelled with the page, so they need no capability grant and are
in every page, browser or app. All the ids are the page's own and shared
(`clearTimeout` cancels a `setInterval`, `timer_cancel` a `setTimeout`).

- A one-shot (`after`, `setTimeout`, `sleep`) runs exactly once, even if its
  callback is slower than its delay or throws: it leaves the queue before its
  callback runs.
- Timers run in order of due time, then of being set; each callback is
  followed by the page's promise jobs. HTML's clamping: a negative, `NaN` or
  overflowing delay is 0, and from a timer nested more than five deep (or an
  interval past its fifth run) at least 4 ms. `ui.timer` keeps its 10 ms floor.
- `setTimeout(fn, ms, ...args)` and `setInterval` pass the extra arguments;
  a string handler is a `TypeError` (sae does not `eval` it).
- `requestAnimationFrame` (`ui.frame`) runs `fn` once, on the next display
  frame from aether-ui's frame clock (`ui.on_frame`: GTK4's frame clock,
  CADisplayLink, Choreographer, DwmFlush on Windows). Every callback in one
  frame gets the same timestamp, in fractional milliseconds on
  `performance.now()`'s clock; one that requests again runs in the next frame.
  The page holds a frame subscription only while callbacks wait.
- When the page goes, nothing more of its runs: its timers, intervals and
  frames are cancelled, and a pending `ui.sleep` promise never settles; it
  goes with the page's runtime.
- `SAE_TIME_SCALE` speeds up the clocks a page reads, not its timers.

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
the browser, the page's own origin, and any other origin that consents to
that page with a `Sae-Allow-Origin` header on its answer (the CORS-alike,
under "Browser security rules" below); in an app, the URL prefixes its
`app.json` grants under `capabilities.http` (below, and App mode for the
matching rules), and nothing at all without them.

Anything else is refused: the callback gets `res.ok` false and the reason in
`res.error`. The request runs on an actor and its answer comes back on the
UI thread, where the callback runs. Or await it: `http.fetch(url)` and
`http.fetch(options)` return a promise of the same response object, from
the same actors, refused the same way (`res.ok` false, never a rejection):

```ts
const res = await http.fetch({ method: "POST", url: "/api/notes", body: json });
if (res.ok) render(res.json());
```

After every handler, timer, animation frame and http callback sae runs the
page's pending promise jobs, so an `await` carries on as soon as its answer
is delivered.

### Browser security rules

Thirty years of the web's security is a list of things that were ambient
and had to be fenced afterwards (`docs/roadmap.md`, section 1). sae has no
DOM, no HTML and no cookies, so most of those classes do not exist here;
these are the rules that keep them out as the browser grows, each enforced
in the kernel, each with its attempt in the escape corpus
(`tests/escape/*.ts`, `tests/spec_escape.ae`: sandbox-breakout-alike, after
Tsyne's `examples/sandbox-breakout`) and its happy path in
`tests/spec_webrules.ae`.

- **Keys typed into the chrome are not a page's.** `ui.on_key` hears a key
  only while the page has the focus (one of its own widgets, or none): what
  a person types into the address bar never reaches a page, which would
  otherwise be a keylogger for every URL typed while it is open
  (`tests/spec_keys.ae` types into the address bar and finds the page heard
  nothing).
- **Same-origin by construction.** A page's `http` reaches its own origin
  without asking. Another origin it may *request*, under the CORS-alike
  below; nothing else.
- **The CORS-alike** (roadmap 1.2; the header name is decision 3). A page
  may request another origin; sae sends `Origin: <the page's origin>` (its
  own, never one the page sets), never a `Referer`, and drops the page's own
  `Cookie` and `Authorization` on the way out. The answer reaches the page
  only if the response that ends the request carries
  `Sae-Allow-Origin: <that origin>` or `Sae-Allow-Origin: *`; otherwise the
  body, status and headers are withheld, `res.ok` is false and `res.error`
  says `<url> did not allow this page's origin <origin>: the response
  carries no Sae-Allow-Origin: <origin> (or *)`, logged once. No preflight:
  there are no cookies to protect. A redirect that leaves the origin is
  held to the same consent on the final answer, and a scope may name another
  origin (`"seeks outgoing-http GET https://tiles.example/**"`). App mode is
  unaffected: `capabilities.http` is the list, and the installer saw it.
  `tools/pageserver`'s `/api/cors?allow=<origin or *>` is the consenting
  route the specs use; `http://localhost:8091` is its second origin.
- **No ambient credentials.** No cookie jar (a `Set-Cookie` is never kept),
  no `Authorization` sae attaches on a page's behalf; a page that wants to
  be logged in holds a token in its per-origin `storage` and sends it
  itself. sae adds no header a page did not set, but `Origin` across
  origins. CSRF cannot exist.
- **No `Referer`, ever.** A page-set `Referer` or `Origin` is dropped in the
  browser.
- **No mixed content.** A page from `https:` may not fetch `http:`, from any
  origin: refused before any socket, with `mixed content: a page from https:
  may not fetch http: (<url>)`, logged once; an `https:` page's scope on an
  `http:` origin is refused before the page runs. (A redirect from `https:`
  to `http:` was already refused.) The rule's logic is held without a
  window in `tests/spec_origin_rules.ae`; the spec harness serves pages
  over `http:`, so its end-to-end attempt waits for a lane that serves the
  corpus over TLS.
- **Certificate failure is a refusal.** The TLS client fails closed; there
  is no "proceed anyway".
- **A page cannot touch the chrome.** The handle floor makes `set_text`,
  `get_text` and `clear` on the address bar, the status line or a previous
  page's widgets throw; and a web page navigates only to `http(s)` URLs
  (not to an `app:` page, which the browser would map onto a file by path,
  nor to a file), refused and logged.
- **No windows, frames, pop-ups or opener.** There is no `ui.window`, no
  `open`.
- **Navigation is a full page load.** Each page has its own runtime,
  timers, handles and storage scope; nothing survives across except
  per-origin `storage`.
- **Resource caps per page:** 5 s per entry into JS and a 32 MB heap, as
  before, and now 8 http requests in flight, 256 timers and animation frames
  pending, and 4 MB of `storage` per origin. Over a cap the call throws a
  `TypeError` naming it (`http: this page has 8 requests in flight (the
  cap); wait for one to finish`), logged once per page per cap. The numbers
  are `ESC_*` constants at the top of the "wave1/escape" section of
  `src/sae_host.ae`.
- **Coarse clocks in the browser** (roadmap decision 1, implemented behind
  one switch). `performance.now()` and animation-frame timestamps are
  rounded down to 100 us in the browser; an app has full resolution.
  `SAE_COARSE_CLOCKS=0` turns it off, `=1` turns it on, in either mode.
  `Date.now()` stays whole milliseconds.
- **No fingerprinting surface, no code from anywhere else.** No
  `navigator`, no device details, no module loader: `import()` of any URL
  rejects (`tests/spec_globals.ae` pins the whole global surface).

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
- `sqlite.<name>`: the app's databases, declared in `app.json` under
  `capabilities.sqlite` with their migrations (App mode, below).
- A web page has no `fs`, no `shell` and no `sqlite` at all.

A page says at its top which privileges it seeks, one per line:

```ts
"seeks local-filesystem";   // unlocks fs
"seeks outgoing-http";      // unlocks http
"seeks open-urls";          // unlocks shell.open
"seeks database notes";     // unlocks sqlite.notes (one line per database)
```

`ui`, `vg`, `storage`, `browserContext` and the timer globals (`setTimeout`
and friends, page-scoped, so never sought) every page has; an object it
does not seek it does not have, by any route (`tests/spec_globals.ae` holds
the whole global surface to a list, in both modes). A page that
names `fs`, `http` or `shell` without seeking it is refused when it is read
(`page:4:1: fs needs "seeks local-filesystem" at the top of the page`), and
one that seeks what its context does not grant is refused before any of it
runs, saying what is missing (`seeks local-filesystem, which a web page in
the browser cannot have`). A seek can be narrowed to what the page will
actually do, and sae holds every request to it, redirects included:

```ts
"seeks outgoing-http GET,POST /api/*";            // these methods, this path, its own origin
"seeks local-filesystem, reduced functionality without";   // loads without it; fs is then absent
```

A function that starts `"hide fs";` (with every function inside it) may
not name `fs`. `docs/app-capabilities.md` has the whole design.

### Storage

`storage.get(key)` (a string, or `null`), `storage.set(key, value)` and
`storage.remove(key)`: values that outlive the page and the process, like
`localStorage`, under `~/.sae/storage` (`$SAE_STORAGE_DIR` overrides it;
`.sae/storage` in the working directory where there is no `$HOME`, as in an
APK). Each has its own:

- an **app**, by what identifies the installed app, never its display name
  (two apps may share one): a packaged `.app`'s bundle identifier
  (`app-id-<bundle id>`; give `tools/saepack.sh` a distinct one for each
  app), otherwise its folder, canonical and hashed
  (`app-<folder>-<hash>`: `sae --app <dir>`, and an APK, whose pages live
  in the package's own files folder);
- an **origin** in the browser;
- a **folder**, for pages loaded from files (`file-<folder>-<hash>`): the
  file system's nearest thing to a site, so pages that link to one another
  in a folder share storage and pages elsewhere do not. Per file would
  split a folder of pages that work together; one scope for every file, as
  before, let any local page read another's.

Storage kept by sae before this was keyed by an app's name (`app-<name>`)
or shared by all file pages (`file`). It is not moved: two apps with one
name shared that folder, so there is no telling whose it was. To keep an
app's data, move its old folder's files into the new one by hand. Keys are
letters, digits, `.`, `_` and `-`; a value is at most 1 MB. The file system
stays the kernel's: a page reaches only these three calls.

`SAE_TIME_SCALE=<n>` runs the clocks pages see (`Date.now`, `new Date()`,
`performance.now`) n times fast, for specs that wait on timers.

### Modules: `import`, `export` and the `sae:` library

A page may import, with plain ES syntax (so `tsc` and editors understand
it), from two places and nowhere else:

```ts
import { card, type Card } from "./lib/card.ts";     // its own origin (or bundle)
import * as cards from "/lib/card.ts";              // the same, origin-relative
import { noise, fbm2 } from "sae:noise";            // the page standard library
import { linear } from "sae:scales#sha256-...";     // optional: the bytes it expects
```

- **Where from.** In the browser, a relative or absolute path on the page's
  own origin (an absolute `http(s):` URL only if it is on that origin); in
  an app, a path inside the bundle (`./lib/x.ts`, `/lib/x.ts` or
  `app:/lib/x.ts`); for a page loaded from a file, a file in the page's own
  folder; and `sae:<name>` anywhere. Everything else is refused before any
  of the page runs, with the reason on the page and the console: another
  origin, `data:`, any other scheme, a bare name (there is no npm here), a
  path that climbs out (`..` above the bundle or folder), a module the
  server does not have (anything but a 200), an import cycle (named), and
  a `#sha256-<hex>` that does not match the fetched bytes. Dynamic
  `import()` stays refused: no loader is installed for it.
- **Before the page.** Imports are static and run first: sae fetches the
  page's whole import closure on the same path and rules as pages, lowers
  each module, runs them in dependency order into a per-page registry
  (freed with the page), then runs the page. A module runs once per page
  load, however many pages import it; its `export`s are getters on a
  namespace object, so `ns.count` reads the module's `let` as it is now,
  while `import { count }` is a copy taken when the import runs. Modules
  are `export const/let/var/function/class`, `export { a as b }`, `export
  default`, and the re-exports `export { a } from`, `export * from`,
  `export * as ns from`. A module cannot `"seeks"`; it may name what the
  page importing it sought. A page cannot `export` (nothing imports a
  page). `lower/README.md` has the rewrite, the one non-erasure the
  lowerer makes.
- **The `sae:` library** (`lib/sae/`): modules sae carries, loadable in
  the browser and in apps with no capability, each hashed at build time
  into `lib/sae/MANIFEST` (`tools/hash-lib.sh`, run by `./build.sh`) and
  refused if its bytes differ. The first three, written in the dialect:
  - `sae:noise`: `value1/value2` (0..1), `perlin1/perlin2` (-1..1),
    `fbm1/fbm2(x, y, { octaves, persistence, lacunarity })`, `hash1/hash2`,
    `random(seed)` (a stream) and `noise(seed)` (all of them fixed to one
    seed); every value is a pure function of its inputs and the seed, the
    same on every machine.
  - `sae:scales` (d3-alike): `linear()`, `log()`, `band()`, `ordinal()`
    with chained `.domain()`/`.range()`, `.invert()`, `.clamp()`,
    `.ticks(n)`, `.nice()`, `.bandwidth()`/`.step()`/`.padding()`, plus
    `ticks(start, stop, count)` and `tickStep`.
  - `sae:easing`: `linear`, `easeIn/Out/InOut` × `Quad Cubic Quart Quint
    Sine Expo Circ Back Elastic Bounce`, `lerp`, `clamp01`, `tween(from,
    to, t, curve)`, `ease(name)` (by name, `"outCubic"` or
    `"easeOutCubic"`) and `names`.

  `SAE_LIB_DIR` names another library directory; otherwise sae looks
  beside its binary (`lib/sae` next to `bin/`, a `.app`'s
  `Resources/lib/sae`, or this repository's `lib/sae` above
  `target/build/bin/`). Credit: Cosyne's library tier (Tsyne) for the idea
  of a page-side library; the modules are sae's own.
- **Top-level `await`.** A page may `await` at its top level; it runs on
  from where its promise settles (its widgets built in order, handlers
  live meanwhile), and a throw after the first `await` is reported like
  any uncaught exception. A module may not (its exports are ready when the
  page runs).

A page with an import or a top-level `await` runs inside a function (the
lowerer's wrapper), so its top-level declarations are not globals; a page
with neither is the script it always was. `site/imports.ts` and
`site/import_noise.ts` are the demos, `tests/spec_imports.ae`,
`tests/spec_app_imports.ae` and `tests/check_module_rules.sh` the specs.

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
| scene | `scene(viewBox, w, h, fn)`: a `w` x `h` px canvas under the current `ui` container, drawing the `"x y w h"` viewBox; returns the scene's handle |
| shapes (each returns a handle) | `circle(cx, cy, r, fn?)`, `rect(x, y, w, h, fn?)`, `rrect(x, y, w, h, r, fn?)`, `ellipse(cx, cy, rx, ry, fn?)`, `line(x1, y1, x2, y2, fn?)`, `path(d, fn?)`, `polygon(points, fn?)`, `polyline(points, fn?)` (points as SVG writes them, `"x,y x,y"`, or a flat array), `text(x, y, s, fn?)`, `text_sized(x, y, size, s, fn?)`, `text_anchored(x, y, size, "start"/"middle"/"end", s, fn?)` |
| groups | `g(fn)`: its block's `fill`, `stroke`, `opacity` and `transform` reach the shapes inside it (transforms compose outer first, opacities multiply, a shape's own paint wins); `into(h, fn)` builds into a group again |
| modifiers (inside a shape's or group's block) | `fill(color)` (or `"url(#id)"`), `stroke(color, width)`, `opacity(v)`, `transform(t)`, `linecap(c)`, `linejoin(j)`, `tooltip(s)`, `cursor(c)` |
| events (inside a shape's block; viewBox units) | `on_click(fn(x, y))`, `on_double_click(fn(x, y))`, `on_hover(fn(inside))`, `on_drag(fn(x, y, dx, dy))`, `on_drag_end(fn(x, y))`, `on_scroll(fn(dx, dy))` (dy < 0 is away from the user), `on_right_click(fn(x, y))` (kept; no canvas reports one yet) |
| defs (inside a scene's block) | `defs(fn)` holding `linear_gradient(id, x1, y1, x2, y2, stops, opts?)`, `radial_gradient(id, cx, cy, r, stops, opts?)` (stops `[[offset, color, opacity?], ...]`; opts `{ units, transform, href, spread, fx, fy }`), `clip_path(id, shapes, opts?)`; `css(text)` |
| bindings (in a block, or `(h, fn)` from anywhere) | `bind_fill(fn)`, `bind_stroke(fn)` (a colour or `[colour, width]`), `bind_opacity(fn)`, `bind_text(fn)`, `bind_transform(fn)`, `bind_pos(fn)` (an object of geometry: `cx`, `cy`, `r`, `x`, `y`, `w`, `h`, `x1`...), `visible_when(fn)`; re-evaluated on every state set (`refresh()` does it by hand) |
| data joins | `items(list_state, key, render(item, i) → h, update?(item, h, i))` in a group: enter, update and exit by key |
| tweens, on the frame clock | `animate(h, { to: { fill, opacity, cx, ..., rotate, scale, translate }, ms, easing, center, from }, done?)` or `animate(numberState, { to, ms })`; easings `linear`, `ease_in`, `ease_out`, `ease_in_out` or a function; returns `{ cancel(), done }` |
| zoom and pan | `view_box(state or fn)` in a scene's block: the viewBox follows it; `set_view_box(scene, vb)` |
| later, from anywhere | `set_fill(h, color)`, `set_stroke(h, color, width)`, `set_opacity(h, v)`, `set_text(h, s)`, `set_transform(h, t)`, `set_visible(h, on)`, `set(h, { ...props })` (several at once, one repaint), `get(h)`, `remove(h)`: change a shape or group and repaint |
| pixels | `raster(w, h, rgba, fn?)`: a w x h image element from a `Uint8Array` of RGBA8 (w*h*4 bytes), at (0, 0), one viewBox unit a pixel; `raster_update(h, rgba)` new pixels in place; `image(bytes, fn?)`: a PNG/JPEG/GIF/BMP decoded by the toolkit, at its own size; `raster_size(h)` → `[w, h]` |
| text metrics | `measure(text, size)` → `{ width, height, ascent, descent }` in px, the toolkit's own metrics for what `text` draws; `ellipsize(text, size, maxWidth)`: cut to fit, ending in `…` |
| in a raster's or image's block | `box(x, y, w, h)` where it draws, `fit(mode)`: `"stretch"` (default), `"contain"`, `"cover"`, `"original"`; `rendering(mode)`: `"auto"` (default, smoothed) or `"pixelated"` (each pixel a crisp square when scaled); and `on_click`, `opacity`, `transform` as for any shape |

### AeVG alive: the SVG model as TypeScript

A scene is source, not a loaded file: the picture and its behaviour are one
page. sae keeps a record of each scene (`aevg/module.ae`): every group and
shape with its parent, so a group's transform, opacity and paint reach its
children when they are made and when they change (`set_transform` on a
group turns everything in it: the camera's mode dial); the defs and CSS
registered on the scene, put back when the viewBox changes (zoom and pan
rebuild the viewBox-to-canvas mapping); and the page's handlers, which the
host dispatches itself, hit-testing the topmost shape with one.
`site/aevg.ts` shows the grammar, `site/aevg_live.ts` the bindings, the data
join, tweens, events and zoom; `tests/spec_aevg.ae` reads every one back
as rendered pixels.

**Gradients**: `defs` registers them on the scene and a shape takes one
with `fill("url(#id)")`; `spec_aevg` reads a linear and a radial one back
as pixels. `clip_path` and CSS class selectors are registered and wait for
shapes to carry a clip or class attribute.

`saelower --from-svg drawing.svg [--size N] [--solid]` turns an SVG into
such a page, once (`aevg/tsemit.ae`, the same walk as aether-ui's Aether
transpiler, a TypeScript output): shapes read like the SVG, modifiers in
their blocks, groups nest (not flattened: the host cascades), `<use>` is a
group with its transform, path data normalised to absolute M/L/C/Z, each
shape's SVG id as a comment. `--solid` paints a gradient fill as its middle
stop's colour. It skips, saying so in a comment: filters, `clip-path=` on a
shape, `<image>`, `<style>`, markers and patterns.

The proof is the corpus: `tools/gen-corpus.sh` emits five W3C/CVG files as
`site/corpus_<name>.ts`, and `tests/spec_aevg_parity.ae` renders each
through the driver and measures the mean per-pixel error against librsvg's
reference PNG (`tests/lib/png_mae.py`, the measure of aether-ui's
`vg/test/svg-compare-aevg.py`): heart 1.04, beacon 1.87, compass 2.68, atom
4.49 (0 to 255; under 5 is antialiasing), and AJ_Digital_Camera 33.70, whose
body is 175 gradients that do not paint yet. `site/camera.ts` is that
camera, emitted with `--solid` and made operable (demo 1b: turn the mode
dial, press the shutter, zoom the lens, the LCD bound to state), and
`site/clock.ts` places one clock-face component four times by transforms,
its hands bound to the time; `tests/spec_camera.ae` drives both.

### Pixels from a page

```ts
const px = new Uint8Array(64 * 64 * 4);              // straight RGBA8, row-major
const life = vg.raster(64, 64, px, () => {
  vg.box(0, 0, 64, 64);
  vg.on_click((x, y) => toggle(Math.floor(x), Math.floor(y)));   // viewBox units
});
... write into px, then
vg.raster_update(life, px);                            // copied in, repainted
vg.image(pngBytes, () => { vg.box(10, 10, 40, 30); vg.fit("contain"); });
ui.image(pngBytes);                                    // the picture as a widget
```

A raster is an AeVG image element (aether-ui's `vg.image`), so it is
transformable, hit-testable and has opacity like any shape, and the scene
repaints it on `raster_update`. The host copies the page's bytes (a
`Uint8Array` or `Uint8ClampedArray`; anything else is a `TypeError`), so
the page may reuse its array at once. Budgets, per page and provisional
(roadmap decision 9): 4096 on either dimension and 32 MB of pixels in total,
decoded images included, refused with a `TypeError` that says which; a
page's rasters are freed with the page. Page-scoped, no capability.
`site/raster.ts`, `site/terrain.ts` (demo 13) and `site/life.ts` (demo 14)
use it; `tests/spec_raster.ae`, `spec_terrain.ae` and `spec_life.ae` read
the pixels back. The bytes come from `contrib.quickjs`'s `arg_bytes`
(Aether 0.801.0; `asks/quickjs-typed-array-bytes.md`, resolved).

Where a Cosyne app writes `c.circle(30, 40, 18).fill("#c44").onClick(f)`, a
sae page writes `vg.circle(30, 40, 18, () => { vg.fill("#c44"); vg.on_click(f) })`.
A shape outside `vg.scene()`, or a modifier outside a shape, throws.
`vg.set_fill`, `set_stroke`, `set_opacity` and `set_text` change a shape
after the scene is built.
`site/vg.ts` is the demo, and `tests/spec_nav.ae` checks its colours
through the driver's canvas pixel route.

A page reaches only what `api_register_` (in `src/sae_host.ae`) installs in
its runtime: the language builtins, `print`, `ui`, `vg`, `http`, `storage`
and `browserContext`, plus `fs` and `shell` in app mode only, and the
`$sae` loader object its wrapper takes when it imports (whose `m` returns
only modules the page imported statically). QuickJS's own `std`/`os`
modules are not compiled in. There is no `load()`, no file system and no
process access.

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
`services/files`, `services/shell`, `services/net` and `services/stdlib`
(the `sae:` library and the import hashes), each able to reach only its
imports: only `services/shell` can name the system URL opener.
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

The desktop build selects AppKit on macOS and GTK4 on Linux/FreeBSD.
On Debian/Ubuntu, install the GTK4 build dependencies with
`sudo apt install build-essential pkg-config libgtk-4-dev libepoxy-dev`.

The sibling checkouts are reached through symlinks at the repo root:

| link | points to | why |
|---|---|---|
| `aether-ui` | `../aether-ui` | the toolkit; its `backend/` is compiled into sae |
| `ui` | `aether-ui/ui` | so `import ui` resolves: aetherc looks up imports from the project root |
| `vg` | `aether-ui/vg` | the same for AeVG (`import vg`, `import vg.live`) |

```sh
./build.sh                     # target/build/bin/sae
target/build/bin/sae pages/hello.js
target/build/bin/sae site/algos.ts    # algorithm theatre, including its local imports
SAE_NO_WINDOW=1 target/build/bin/sae pages/hello.js   # build the page, print timings, exit
```

In the address bar, local paths are relative to the working directory, as
on the command line. Pressing Go on `site/algos.ts` loads that same file.
Links within a page still resolve relative to that page's directory.

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
{ "name": "Sae Tasks", "start": "/", "width": 480, "height": 420,
  "capabilities": { "http": ["https://api.example.com/repos/", "https://*.example.com/"] } }
```

(all optional). `name` titles the window, `start` is the first page (an
app's own: `app:/`-relative), `width` and `height` size the window, and
`capabilities` grants what the app may do beyond its pages (below).
`capabilities.http` is the app's whole network, a list of URL prefixes
after Tauri's HTTP-plugin scopes:

- **Absent or empty, no network at all** (deny by default): `http` is not
  available to its pages, and a page that requires it is refused at load.
- A URL is allowed if a prefix covers it: first its server, then its path.
  Scheme, host and port must match exactly, a default port being the same
  as writing it (`https://h/` is `https://h:443/`; `http://localhost:8091/`
  is not `http://127.0.0.1:8091/`), compared parsed, not as text, so
  `https://h.com` does not cover `https://h.com.evil.test/`. Then the path
  (and query) must start with the prefix's path as written; a path with a
  `.` or `..` segment is refused. `https://*.example.com/` covers any one
  leftmost label (`api.example.com`, not `example.com` or
  `a.b.example.com`); the rest must have two labels, or be `localhost`. An
  entry sae does not understand allows nothing, and is reported at start.
- It is checked in `services/net`, the one place sae opens a request,
  before any name is looked up or socket opened, and again on every
  redirect hop (sae follows redirects itself). A refusal is `res.ok` false
  with `this app may not reach <url> (app.json capabilities.http lists
  what it may)` in `res.error` (`redirected to <url>: ...` for a hop), and
  is logged once on the console.
- `app:/` pages are not network: they load and navigate whatever the list
  says, and an app loads no page from anywhere else (`start` included).
- Browser mode has no list: a web page reaches its own origin, and another
  origin only with that origin's consent (the CORS-alike, "Browser security
  rules").

`capabilities.sqlite` gives an app databases it owns, by name, the engine
being Aether's `contrib.sqlite` (the same one LisMusic builds for Android):

```json
"capabilities": { "sqlite": { "notes": { "migrations": ["db/001_init.sql", "db/002_tags.sql"] } } }
```

- **The name is the handle.** A page says `"seeks database notes";` and
  gets `sqlite.notes`; sae decides where the file lives (the app's storage
  folder, keyed per installed app as `storage` is, under `.sqlite/`), and no
  page ever names a path. An unsought database is absent; one app.json does
  not declare is refused at load (`seeks database nope, which this app's
  app.json does not grant`).
- **Migrations are sae's job.** At start, before any page runs, sae applies
  in order the listed scripts (paths inside the app, each a file of SQL,
  several statements allowed) the database has not seen, each in a
  transaction, recording it in `_sae_migrations`. A migration that fails
  keeps nothing and refuses the app with the reason (`sqlite notes:
  migration db/002_tags.sql failed: no such table: x`, in the window and on
  the console, exit status 1 under `SAE_NO_WINDOW`). Small starter data is
  just `INSERT`s in a migration.
- **One actor per database.** `all`, `get`, `run` and `transaction` return
  promises; each call is a job on the database's own Aether actor, off the
  UI thread, run in the order the page made them, its answer delivered on
  the UI thread (the http pattern). A slow query never freezes the window.
  A transaction holds the database: calls from other callers wait until it
  ends (the page's own plain calls join it), and a page left mid-transaction
  has it rolled back before anything else runs.
- **Values are parameters.** `?` with an array, `$name` with an object; a
  count that does not match the statement is an error, not a `NULL`. One
  statement per call. Rows come back as plain objects, `INTEGER` as a
  number, `REAL` as a number, `TEXT` as a string, `NULL` as `null` (`BLOB`
  as text in this version).
- **Escape routes off, in the engine.** Every connection has an authorizer
  that denies `ATTACH`, `DETACH` (so `VACUUM` too, which attaches a file:
  in place or `INTO`), `load_extension()` and the directory PRAGMAs
  (`temp_store_directory`, `data_store_directory`); `SQLITE_LIMIT_ATTACHED`
  is 0 and extension loading is off. A refused statement rejects with
  `not available to an app: a database is one file (...)`. This is the
  engine's answer, not a reading of the SQL: a statement handed to
  `contrib.sqlite` on the same connection is refused the same way
  (`tests/spec_sqlite_service.ae`).
- Not yet (`docs/page-services.md`, 6): bundled read-only databases and
  large seeds (versions 2 and 3), binary columns, a page-named database.

Pages are `app:` URLs, mapped like the dev page server maps
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

`tools/saepack-android.sh <dir>` packages the same folder as an Android APK
(into `target/apps/`), through aether-ui's `tools/android-apk.sh`: sae built
as the library Android's activity loads, its Aether `main()` the entry as on
the desktop, and the pages packed as assets that the backend copies out to an
`app/` folder in the directory it runs the app in, where a sae started with no
arguments looks for them. `AETHER_UI_WITH_DRIVER=1` links the AetherUIDriver.
An app without `capabilities.http` gets an APK without the INTERNET permission
(`ANDROID_NO_INTERNET=1` to android-apk.sh), except with the driver, which is
a socket server and needs it.
Pages load from the bundle; an `https:` fetch from a page needs a TLS-capable
cross build (aether-crossbuild's sysroot), which the APK does not have yet.

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
SAE_TEST_START=site/algos.ts tests/run_spec.sh spec_local_nav  # local address bar and history
tests/run_spec.sh my_spec ../my-site
```

The launcher starts `target/pageserver` on the site and `sae-driver` on port
9222 (uidriver's), then runs the spec with both driver modules on
`AETHER_LIB_DIR`. `lower/run-tests.sh` runs the lowerer's tests (needs `target/saelower`).

## Status

Done: the spike (five builders through the context stack, click handlers held
as GC roots, per-phase timings; numbers in `docs/spike-results.md`), HTTP
fetch, history and navigation, browser chrome, the page-dialect lowerer. Not
yet: more of the `ui` surface, the bytecode cache, a Win32 build arm,
`class` in the dialect.
