# Sae it ain't so

A this-fat-UI browser. It fetches **pages** and renders them as real native
widgets or vector graphics, where a page is a small program (layout plus the logic behind it),
not markup. [Tsyne](https://github.com/tsyne/tsyne)-alike: this is [Tsyne's browser](https://github.com/tsyne/tsyne/blob/main/core/src/browser.ts) mode rebuilt on the Aether
stack, as proposed in `aether-ui/docs/design/tsyne-migrated.md`.

One native binary links three things:

- **mquickjs-ae**: the Aether port of Fabrice Bellard and Charlie Gordon's
  MicroQuickJS, unchanged. Each page gets its own `JSContext` in its own
  fixed memory block.
- **aether-ui**: the native widget toolkit (AppKit here; GTK4 and Win32 are
  the same `ui` builders).
- **sae's host** (`src/sae_host.ae`): the browser window and the page API.

No Node, no bridge process, no IPC: a page's `ui.text("x")` is an
in-process call into aether-ui's `ui/module.ae` builders.

## A page

Pages are written in a TypeScript dialect: TypeScript that erases
(`--erasableSyntaxOnly`) over ES5 plus a written list of ES2015 forms. The
browser lowers each page to ES5 in-process before the engine sees it; see
`lower/README.md` for the dialect.

```ts
interface Link { label: string; href: string }
const { text, btn } = ui;

const links: Link[] = [{ label: "About", href: "/about" }];
text(`You are at ${browserContext.currentUrl}`);
for (const link of links) {
  btn(link.label, () => browserContext.changePage(link.href));
}
```

Plain ES5 is valid dialect too, and passes through unchanged.

Container builders take their block as the last argument, the way Aether's
trailing block works: `ui.vstack(4, fn)` makes the stack under the current
parent, runs `fn` with the stack as the parent, and pops it again even if
`fn` throws.

The `ui` object (each builder returns its widget handle):

| | |
|---|---|
| containers | `vstack(spacing, fn)`, `hstack(spacing, fn)`, `scroll(fn)`, `button(label, fn)` (the block styles the button) |
| widgets | `text(s)`, `btn(label, onPress)`, `divider()`, `spacer()`, `textfield(placeholder, onChange(text))` |
| modifiers (inside a block) | `margin(t, r, b, l)`, `bg_color(r, g, b, a)`, `onclick(fn)` |
| reading and writing | `get_text(h)`, `set_text(h, s)`: synchronous, no `await` |
| reactive state | `ui_state(v)`, `ui_set(state, v)`, `text_bound(state, prefix, suffix)` |

A modifier at a page's top level has nothing to modify (the top of the stack
is the browser's own content area), so it throws, where Aether would refuse
to compile it. `site/calculator.ts` is the design doc's calculator example.
Pages are not given `window()`: the browser owns the window.

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
`site/vg.ts` is the demo, and `tests/spec_nav.ae` checks its colours
through the driver's canvas pixel route.

A page reaches only what `gen/sae_spec.ae` registers: the language builtins,
`print`/`console`, `ui`, `vg`, and `browserContext`. There is no `load()`, no file
system and no process access.

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
| `mqjs` | `../mquickjs-ae` | the engine; `.build.ae` takes its source list from `mqjs/gen/mqjssources` |
| `ui` | `aether-ui/ui` | so `import ui` resolves: aetherc looks up imports from the project root |
| `vg` | `aether-ui/vg` | the same for AeVG (`import vg`, `import vg.live`) |
| `ae` | `mqjs/ae` | the same for the engine's ~170 files, which `import ae.<module>`. Not the `ae` tool |

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
and the aeb in `target/toolchain/bin` if present. mquickjs-ae needs Aether
0.760+ and aeb b0cc057 or later (see its `ci-pins`).

To drive the window over HTTP with the AetherUIDriver:

```sh
AETHER_UI_WITH_DRIVER=1 ./build.sh          # target/build/bin/sae-driver
AETHER_UI_TEST_PORT=9333 target/build/bin/sae-driver pages/hello.js &
curl -s localhost:9333/widgets
curl -s -X POST localhost:9333/widget/9/click
```

The driver build is a separate binary because the control server must not
ship in `sae`.

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
