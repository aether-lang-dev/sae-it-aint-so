# sae, the next stretch: a browser that cannot be escaped, apps that earn trust, a terser dialect, and AeVG alive

A design note for Paul and Nic, written 2026-10-08, after the day's work
landed (`docs/page-services.md` has the IoC model and the agreed files and
SQLite designs). Nothing here is built yet except where it says so. It is in
three parts: what the web taught us and what sae does with it (browser mode,
then app mode), how the dialect and AeVG grow, and a set of demo apps that
pull all of it forward, with a build order at the end.

The vision in this note is borrowed from Tsyne and Cosyne (`not-ours/tsyne`):
browser mode, pages served by any backend, streaming, the remote display,
the demos. Tsyne never shipped, so it has no security lessons to lend; those
come from the web itself (section 1) and from the platforms that got app
trust right or wrong (section 2). Credits are "-alike" and by name. No code
is borrowed; `not-ours` is ideas only.

Terms, once:

- **Origin**: the scheme, host and port of a URL (`https://shop.example:443`).
  The web treats everything from one origin as one party.
- **Same-origin policy (SOP)**: a page may read only from its own origin.
  **CORS** is the web's opt-in to let a *server* say "pages from origin X may
  read me". Both were bolted on after the fact; sae gets to start with them.
- **Ambient authority**: power code has just by running. `fetch`, cookies
  sent on every request, `window.open`: all ambient on the web, all the root
  of some attack class. sae hands a page nothing it was not given
  (`page-services.md` section 1).
- **Capability**: an object that is both the permission and the means.

## 1. Browser mode: the web's lessons, applied at birth

Thirty years of DOM security is a list of things that were ambient and had to
be fenced afterwards: cookies (CSRF), script-in-markup (XSS), cross-origin
reads (SOP/CORS), opener handles (tabnabbing), framing (clickjacking),
`Referer` (leaks), click-through certificate warnings, timers fine enough to
read cache state (Spectre). sae has no DOM, no HTML and no cookies, so most of
these classes do not exist here; the point of this section is to make sure
they *cannot* be reintroduced as the browser grows.

### 1.1 Rules, stated so they can be tested

| Rule | Today | To do |
|---|---|---|
| **Same-origin by construction.** A page's `http` reaches its own origin and nothing else. | done; the CORS-alike (1.2) is the one cross-origin case, done | keep |
| **No ambient credentials.** No cookie jar, no `Authorization` sae attaches on a page's behalf. A page that wants to be logged in holds a token in its per-origin `storage` and sends it itself. CSRF cannot exist. | done: written down (README "Browser security rules"), `spec_webrules` holds that sae adds no header a page did not set and ignores `Set-Cookie` | keep |
| **No `Referer`.** Cross-origin requests (once allowed) carry `Origin` only. | done: `Origin` across origins, never `Referer`, a page-set `Origin`/`Referer` dropped (`spec_webrules`) | keep |
| **No mixed content.** A page from `https:` may not fetch `http:`. | done: refused with the page-level reason, logged once; scopes too (`services/net mixed_content`, `spec_origin_rules`) | an https: lane for the corpus's end-to-end attempt (the harness serves http:) |
| **Certificate failure is a refusal, not a warning.** The pure TLS client fails closed. No "proceed anyway" in v1: the web's lesson is that warnings get clicked. | done (TLS) | surface the reason in the chrome; show scheme and host as the lock-icon-alike |
| **A page cannot touch the chrome.** The handle floor already makes `set_text` on the address bar throw. | done; in the corpus (`chrome_set_text`), and a web page navigates only to http(s) URLs (`chrome_navigate`) | keep |
| **A page cannot open windows, frames or pop-ups,** and has no opener. | done by absence; in the corpus (`second_window`) | keep |
| **Navigation is a full page load.** Each page has its own runtime, timers, handles, storage scope; nothing survives across except per-origin `storage`. | done; in the corpus (`handle_across`) | keep |
| **Resource caps per page.** 5 s per entry into JS, 32 MB heap. | done, and: 8 http in flight, 256 timers and frames, 4 MB storage per origin (`cap_*` in the corpus) | a per-origin memory budget |
| **Coarse clocks in browser mode.** `performance.now()` and frame timestamps rounded (100 µs), as browsers did after Spectre; app mode keeps full resolution. | implemented behind one switch (`SAE_COARSE_CLOCKS`, on in the browser, off in an app; `spec_webrules` in both modes) | decision 1: confirm the default, then drop the switch or keep it |
| **No fingerprinting surface.** No `navigator`, no device details; `browserContext` exposes the URL and navigation only. | done (`spec_globals` pins the surface) | keep |
| **No code from anywhere else.** No module loader, no `data:`/`http:` imports. | done; same-origin and `sae:` static `import`, hashed (3.1), **built** | keep as a red-team case (`tests/spec_imports.ae`, `tests/check_module_rules.sh`: cross-origin, `data:`, cycle, hash, climb-out, `import()` refused) |
| **Navigation cannot climb out.** `changePage` collapses `.` and `..` and refuses a path above the bundle (app), the site root (browser) or the page's folder (a file page), the same rule imports use. | **done** (found by the imports work: app-mode `changePage("../../x")` read outside the bundle) | keep as a red-team case (`tests/escape/climb.ts`, `tests/spec_app_climb.ae`) |

### 1.2 The one cross-origin case: a CORS-alike

A real site has one page origin and a few data origins (a reviews service, a
maps tile server). The web's answer is CORS; its mistake was shipping
credentials with it. sae's version:

- A page may request another origin only if that origin says so: the
  response carries `Sae-Allow-Origin: https://shop.example` (or `*`). sae
  sends `Origin` and no `Referer`, never credentials, and discards the body
  if the header is absent. No preflight: there are no custom headers to
  negotiate, and no cookies to protect. **Done** (wave 1): README "Browser
  security rules", `spec_webrules`; a redirect that leaves the origin needs
  the consent on the final answer, and a browser page may scope another
  origin.
- In app mode this is moot: `capabilities.http` is the allowlist and the
  installer saw it.

### 1.3 Containment under the page API: `containment-sandbox.md` in the browser

The page API is the first line (a page reaches only what `api_register_`
hands it). `aether/docs/containment-sandbox.md` gives sae a second line
underneath it, and `architecture.md` already lists it as stage 3. Concretely:

1. **`sandbox.enforce` around every entry into page code**: the page's first
   run, every handler, timer, frame and http callback. The browser's outer
   grant list is `grant_tcp("*")` plus `grant_fs_read` of sae's own cache
   folder and nothing else: no exec, no env, no native. Each page gets an
   inner list of `grant_tcp(<its origin's host>)`; nested `enforce` blocks
   intersect, so a page can never widen what the browser allowed. A kernel
   bug that reaches `std.fs` or `std.net` from page code is then refused at
   run time, logged, and reported as a page error, not executed.
2. **The gate generated from one spec, with `seal except`** (stage 2's
   remaining half). Today 81 host functions carry a pasted `hide` line. One
   spec per page-API call (name, argument types, capability, service) would
   generate the Aether gate with `seal except <the service it needs>`, the
   `tests/check_page_veto.sh` probe list, the README table and, in section 3,
   the `sae.d.ts` for authors. One source of truth, compiler-checked.
3. **`std.audit` as the browser's "why was that refused" panel**: every
   denial (capability, sandbox, cap) in one queryable log, shown in the
   devtools overlay (section 5, demo 5) and asserted on by specs.
4. **Below libc, on the lanes that have it**: `libaether_sandbox.so`
   (LD_PRELOAD) on Linux and `std.capsicum` on FreeBSD contain even an
   engine bug's attempt to `open` or `connect`. The ae-x64 and ghostbsd
   lanes run the red-team corpus under them.
5. **Later, the page host in its own process** (`spawn_sandboxed`, seccomp on
   Linux): one process per origin is the site isolation the web reached in
   2018. `architecture.md`'s "Limits" says why this is the only answer to a
   memory-safety bug in QuickJS's C.

The doc's own caveat applies: `extern` calls bypass `std.sandbox`. sae's
kernel is trusted and has no externs in page paths beyond `sae_rom.c`'s
stdout handle; the page cannot declare externs. The engine's C is the
residual risk, which items 4 and 5 address.

### 1.4 A red-team corpus, run on every lane

`site/misuse.ts` and `site/vgmisuse.ts` exist. `tests/escape/*.ts` is the
corpus (wave 1), one page per attempt, each refused and logged once, held
by `tests/spec_escape.ae` (17 attempts; mixed content's end-to-end attempt
waits for an https: lane):

fetch another origin · `http:` from `https:` · a redirect out of origin ·
reach `fs`/`shell` by computed name · navigate the chrome · read another
origin's storage · exceed the CPU, heap, timer and http caps · `import()` a
URL · hold a handle across navigation · spin `Atomics.wait` · forge a
`Sae-Allow-Origin` from the page side · open a second window.

The corpus is the security spec. A new rule in 1.1 is not done until its
attempt is in the corpus and refused on GTK4, AppKit, Win32, UIKit and
Android.

## 2. App mode: how a builder confers trust on the installer

An installer cannot read code. What they can read is a short, honest list of
what an app may do, and they can be told who vouches for it. The web's
experience: install-time blanket permissions get clicked through (Android
before 6), extended-validation certificates failed (nobody looked), but
domain-bound identity worked (Let's Encrypt), purpose strings helped (iOS),
and reproducible builds plus transparency logs are how supply chains are
being secured now (Sigstore, SLSA). sae's strategy, in layers:

1. **The manifest is the contract, and it is legible.** `app.json`
   capabilities are already declarative and narrow, and the app cannot exceed
   them at run time. Two additions: every capability takes a `because`
   purpose string, required by `saepack`, and the installer (and `sae --app`
   on first run) shows the list in plain words:

   > *Gitify may: read your GitHub notifications (api.github.com); open
   > github.com links in your browser. It may not: anything else.*

2. **Least privilege, proven by the app's own tests.** `saepack` runs the
   app's specs under its manifest with `std.audit` on; a grant no test
   exercised is a packaging warning, a page that uses what the manifest does
   not grant is an error (the lowerer already knows what each page seeks).
   "This app asks for only what its tests use" is a claim the package can
   carry.
3. **Signed manifest and content hashes.** The package carries a hash of
   every page and asset and an ed25519 signature (Aether's own
   `std.cryptography.ed25519`) over manifest plus hashes. sae verifies at
   launch: the pages are what was signed, and the manifest cannot be edited
   afterwards to widen grants. The key's identity is its fingerprint, and
   optionally a domain: the builder publishes the public key at
   `https://<domain>/.well-known/sae-publisher`, so "signed by example.com"
   is checkable with no certificate authority.
4. **Reproducible packaging.** `saepack` is deterministic (no timestamps,
   sorted entries), so anyone can rebuild from source with the pinned
   toolchain and get the same bytes; the SHA-256 is publishable, and later
   appendable to a transparency log.
5. **Runtime honesty and revocation.** A "Privacy" screen in the app chrome
   lists each grant and what it reached today, from `std.audit`. The user can
   switch any grant off; the app sees it as the privilege not granted, which
   is exactly what `"seeks ..., reduced functionality without"` already
   handles. Optional seeks are what make revocation safe: this is the design
   link that costs nothing new.
6. **Trust tiers, shown not described.** Unsigned (development only, red),
   signed by a key (fingerprint, amber), signed by a domain-bound key
   (green, the domain), and later "listed" by a curated index.
7. **No code arrives at run time.** Pages are bundled and hashed; `http`
   carries data only; a remote start page is already refused. This is also
   what keeps the App Store door open (`page-services.md` section 9).

## 3. Growing the dialect: terse, elegant, still erasable

The lowerer's principle holds: it erases TypeScript and passes JavaScript
through, so every line stays where the author wrote it. Growth must be
either erasable or one small, documented desugar. In order of leverage:

1. **Modules within an app or origin.** **Built** (README "Modules",
   `lower/README.md` "Modules"): `import { chart } from "./chart.ts"` for
   the page's own origin (browser) or bundle (app), through sae's loader:
   fetched like a page, lowered, hashed (an SRI-alike: an `import` may name
   the hash it expects), never cross-origin, never `data:`. The one
   non-erasure the lowerer takes on: `import` and `export` become a
   sae-provided loader call (`$sae`), resolved before the page runs.
2. **`sae.d.ts`, generated from the gate spec** (section 1.3 item 2). Authors
   get autocompletion and `tsc --noEmit --erasableSyntaxOnly` catches wrong
   calls before a page is served. No grammar change at all; it is the gate's
   second output.
3. **One tagged template, no syntax change:** ``bind`Count: ${n} of
   ${total}` `` is a multi-state `text_bound`. (Not an ``svg`…` `` loader:
   section 4 says why a scene is source, not a string.) **Built** (README "Reactive state": a computed state bound to a
   label; `tests/spec_reactive.ae`).
4. **Reactive sugar that already exists one layer down.** aether-ui has
   `computed`, `bind_text`, `bind_value` (two-way), `bind_enabled`,
   `bind_hidden`, `each` with keyed reconciliation and `ui_batch`. Pages see
   only `ui_state`, `ui_set` and `text_bound`. Expose the rest as
   `state(v)`, `computed(fn, ...states)`, `bind(widget, state)`,
   `each(list, key, render)` and `batch(fn)`. This is the Vue-alike half of
   "SVG + Vue": declare once, never call `set_text` again.
   **Built** (wave1/aevg): `state`, `computed`, `bind` (two-way on a text
   field), `bind_enabled`, `bind_hidden`, `each` with keys and `batch`, as
   page-scoped globals over aether-ui's typed cells, `computed_s`, property
   bindings and `ui_batch` (`src/sae_prelude.js`; `tests/spec_reactive.ae`).

5. **Async-first services.** `sqlite`, the files powerbox and `http.fetch`
   are promises; `await` works in handlers already. Top-level `await` is
   **built**: the lowerer wraps a page in an async function when it sees
   one (`lower/README.md` "The wrapper").
6. **Keyboard and pointer in pages**: `on_key`, `on_drag`, `on_scroll`,
   `on_hover` exist in aether-ui and are needed by half the demos below.
7. **Non-goals, deliberately.** No JSX: it is a real transform, and the
   trailing-block form is the house style (`tsyne-migrated.md`, "Pages stay
   declarative"). No `enum` or decorators: `tsc --erasableSyntaxOnly` refuses
   them too, and the dialect stays "what tsc erases".

## 4. AeVG, alive: the SVG model as TypeScript

**Built** (wave1/aevg; README "Vector graphics" and "AeVG alive"): the
grammar (polygon, polyline, ellipse, sized and anchored text, caps and
joins, groups whose transform, opacity and paint cascade, gradients and
clip paths as defs), components as functions, bindings (`bind_fill`,
`bind_transform`, `bind_pos`, `visible_when`, ...), data joins
(`vg.items`), tweens (`vg.animate` on the frame clock), events (hover,
drag, scroll, double click), tooltips, zoom and pan as viewBox state, and
`saelower --from-svg`. Parity through the driver against librsvg: heart
1.04, beacon 1.87, compass 2.68, atom 4.49, AJ_Digital_Camera 33.70
(`tests/spec_aevg_parity.ae`; the camera was 33.70 until 2026-10-10, when
its gradients started painting: the host had been dropping every gradient's
stops). Open: a shape cannot carry `clip-path=` or a CSS class yet; right
click waits for a canvas hook; export is not started.

AeVG is not an SVG loader. It is the SVG model (shapes, paths, groups,
transforms, gradients, filters, clip paths, text, CSS) as a language:
trailing-block Aether in aether-ui, and the same verbs in TypeScript on a sae
page (`vg.rect(…)`, `vg.g(() => …)`). That aether-ui renders the 208-file
W3C/CVG corpus against librsvg pixel for pixel (`vg/test/svg-compare-aevg.py`:
0.0 mean error on `atom`, 1.1 on `USStates`, 1.9 on Trajan's Column) is the
proof that the model is faithful; it is a qualification of correctness, not
the feature. The transpiler turns a drawing into that source *once* (Trajan's
Column is 500 paths of it, with the interaction woven in by hand); from then
on the scene is code: diffable, parameterised, bound to state. That is the
"SVG + Vue in one language" claim: the picture and its behaviour are one
TypeScript file, and nothing is parsed at run time.

What exists one layer down and pages do not yet see: per-element bindings
(`bind_fill`, `bind_stroke`, `bind_opacity`, `bind_text`, `bind_pos`,
`visible_when`), data joins (`bind_items` with `trackby`, `render` and
`update`: a d3-alike enter/update pattern), tweens (`animate`, `tween_fill`,
`tween_opacity`), events (hover, double and right click, drag, scroll),
tooltips, cursors, text in real fonts and CSS rules.

The page-side plan:

- **The whole grammar in TypeScript guise.** Pages have `circle`, `rect`,
  `rrect`, `line`, `path`, `text`, `g` and four modifiers. Add what a corpus
  file's transpiled source needs: `polygon`, `polyline`, `ellipse`,
  transforms on groups, named gradients and clip paths, text anchoring,
  stroke caps and joins, CSS classes. The test: any corpus file, transpiled
  to AeVG-TS, runs as a page and renders as the parity harness says it
  should.
- **Components as functions.** A clock face is
  `const face = (cx, cy, r) => vg.g(() => { … })`, placed four times by
  transforms (Cosyne's `svg-clock` / `svg-big-ben` composition idea). A
  `<use>` is a function call.
- **Bindings to page state**, so a scene re-renders itself: `vg.bind_pos(hand,
  angle)`, `vg.visible_when(wire, selected)`, `vg.bind_text(lcd, label)`.
- **Data joins**: `vg.items(list, key, render, update)`, which makes a chart
  or a map a few lines.
- **Tweens on the frame clock** that landed today: `vg.animate(h, { to, ms,
  easing })`.
- **Events** for pages: hover, drag, double and right click, scroll,
  tooltips, cursors.
- **Zoom and pan** as a viewBox state (Cosyne's zoom-pan demo is the model).
- **The transpiler as a dev tool**: `saelower --from-svg drawing.svg` emits
  AeVG-TS (the Aether transpiler already emits DSL source; a TypeScript
  emitter is a second output of the same walk). Run once, then edit.
- **Export** of a scene to SVG or PNG through the files powerbox in app
  mode: AeVG-TS in, SVG out, so a sae page can author for the web too.

## 5. Demo apps, chosen to pull the platform forward

Each names what it shows, what it needs from sections 1 to 4, and its
ancestor (ideas only). Browser demos are served pages; app demos are
installable packages that exercise the trust strategy.

| # | Demo | Shows | Needs | Ancestor |
|---|---|---|---|---|
| 1 | **Big Ben, live.** The Elizabeth Tower as AeVG-TS: one clock-face component placed by transforms, hands bound to the clock, click a tower to fly the viewBox to it, hover for the history of each part. | components, `bind_pos`, tweens, zoom-pan, tooltips | 4 | Cosyne `svg-clock` / `svg-big-ben` (idea: compose one clock component by transforms) |
| 1b | **(built: `site/camera.ts`, `tests/spec_camera.ae`; gradients painted as solid colours until aether-ui paints them live)** **The camera you can operate.** `AJ_Digital_Camera` from the corpus (public domain; parity "good"), transpiled once to AeVG-TS, then made real: turn the mode dial (a group rotation bound to state), press the shutter (a tween and an LCD flash), zoom the lens, the LCD text bound to state. The "take one of those and make it interactive" demo. | the full grammar in TS guise, the transpiler's TS output, bindings, tweens | 4 | the W3C/CVG corpus |
| 2 | **Paris, hour by hour.** A server in any language computes crowd density per hex per hour; the page fetches its own origin's JSON and renders a hex heatmap with data joins; a slider scrubs the week, play runs on the frame clock. | same-origin `http`, `items`, colour scales, `bind`, `frame` | 3.4, 4 | Tsyne `larger-apps/realtime-paris-density-simulation` (idea: H3 hexes, temporal profiles) |
| 3 | **Live dashboard.** Line and bar charts updating in place from a streaming response; `batch` coalesces a burst into one repaint. | `http.stream` (new), `items`, `batch` | 3.4, 4, streaming | Cosyne `line-chart`, Tsyne `STREAMING_CONTENT` |
| 4 | **The fat-web shop.** Catalogue pages, a cart in per-origin storage, checkout by POST-redirect-GET, login by a page-held token (no cookies), and a reviews service on a second origin reached through the CORS-alike. Every rule in 1.1 is exercised by a shop that works. | 1.1, 1.2, modules | 1, 3.1 | Tsyne `BROWSER_MODE` sample server (idea: pages from any backend) |
| 5 | **Devtools overlay.** The browser's own inspector: widget tree, storage, timers, frame clock, and the `std.audit` refusal log, as a chrome overlay built with aether-ui, read from the same driver surface the specs use. | 1.3 item 3, aether-ui overlays | 1.3 | aether-ui `apps/inspector` (same idea, in-chrome) |
| 6 | **Sae Notes.** Notes in `sqlite.notes` with full-text search, attachments through the files powerbox, a signed package with purpose strings, the Privacy screen, and grants the user can switch off while the app keeps working. The reference app for section 2. | SQLite v1, files, signing, audit, optional seeks | 2, `page-services.md` 5 and 6 | — |
| 7 | **Gitify, grown up.** Signed, optional `shell.open` (read-only without it), background refresh, notifications. The smallest complete trust story. | 2, notifications | 2 | `examples/gitify` |
| 8 | **SVG Tetris as a page.** The 2004 public-domain SVG game as a sae page: the engine pure TypeScript, the board AeVG-TS, keys, ghost piece, next-piece panel, 60 fps on the frame clock. | `on_key`, AeVG-TS, `frame` | 3.6, 4 | aether-ui `apps/svg_tetris` (alex fritze's CC0 original) |
| 9 | **Sketch.** Draw and drag shapes, snap, group; the scene is AeVG-TS the page holds; save it as SVG through the powerbox, so a sae page authors for the web. | drag events, scene export, files | 3.6, 4, files | aether-ui `apps/sketchpad`, Tsyne `designer` (idea: WYSIWYG that writes source) |
| 10 | **Playground.** Left pane: the page's source in an editor. Right pane: the page running inside a *sub-page*, its own runtime and grants, messages only across the boundary. The iframe done right, and the way a third-party component (a map, a payment widget, an ad) would ever be embedded. | sub-page embedding (new), modules | 3.1, new | Tsyne `larger-apps/literate-programming` (idea: prose and running code side by side) |
| 11 | **Remote table.** A chess or Go board whose opponent is a server in any language; state changes stream in, rendering stays local. Shows sae as a smart display: a 50-byte "move" where a framebuffer would send pixels. | streaming, `svg`, `items` | 3 | Tsyne `REMOTE_GAMES_ETC` (idea: semantic network transparency) |
| 12 | **Particles, kaleidoscope, terrain.** The Cosyne GPU demos. Need the `gfx` scene API of `docs/gpu-pages.md`: a page describes, native code draws, shaders are validated. Last, because a page that writes shaders is a page that can hang a GPU. | `gfx` | gpu-pages | Cosyne `particles`, `kaleidoscope-shader`, `procedural-terrain-gpu` |

| 13 | **Terrain.** Sliders for noise scale, octaves and water level drive a Perlin/FBM heightmap, coloured by height, drawn as a raster the page computes; seed and smoothing as buttons. The first page that needs pixels. **Landed 2026-10-08** as `site/terrain.ts` (value noise in the page until `sae:noise`; `tests/spec_terrain.ae`). | `vg.raster` (8.2), `sae:noise` (8.1), `bind` | 8 | Cosyne `procedural-terrain-canvas` (idea: a library noise function feeding a 2D heightmap) |
| 14 | **Life.** Conway's Game of Life on a raster, with the frame clock, click to toggle cells, patterns from a picker, generations bound to a label. **Landed 2026-10-08** as `site/life.ts` (`tests/spec_life.ae`: a blinker evolves, a click toggles, the frame clock runs it). | `vg.raster`, `frame`, `on_click` | 8.2 | Tsyne `ported-apps/game-of-life` (idea only) |
| 15 | **TodoMVC.** The classic, as the bindings showcase: a list state, `each` with keys, `computed` counts, filters as `visible_when`, no `set_text` anywhere. | `state`, `computed`, `each`, `bind` | 3.4 | Tsyne `examples/todomvc-when` (idea: `when` conditions over state) |
| 16 | **Reversi, then 2048, then chess.** The scene-graph game tier: the board is AeVG-TS with bindings, moves are tweens, legal moves are `visible_when`; the engine is pure TypeScript locally, then a server over a stream for demo 11. | AeVG-TS, tweens, data joins, `on_drag`, streaming | 4, 8.6 | Tsyne `REMOTE_GAMES_ETC` #179-#182 (idea: send intent, not frames) |

Corpus files carry their own licences: `AJ_Digital_Camera` says public
domain; `USStates` (a map worth a data-join demo) is GFDL and GPL from
Wikimedia; the small W3C test shapes state none. Check before a demo is built
on one; aether-ui's rule for Trajan's Column and Tetris was a provenance
block at the top of the file.

The demos ship as a gallery: `site/` grows an index page that launches each
(Cosyne's demo launcher is the model), and the app demos are packages the
installer can read before it says yes.

## 6. Build order (sections 1 to 5 and 8)

Each wave is what a few agent-days can finish and verify on every lane
(GTK4, AppKit, Win32, UIKit, Android), with specs that fail before.

**Wave 1, the foundations (sections 1, 3, 4):**

1. The rules of 1.1 that are not yet enforced (mixed content, caps, coarse
   clocks if agreed, the no-credentials test), the CORS-alike of 1.2, and the
   red-team corpus of 1.4 run on all lanes.
2. `sandbox.enforce` around every page entry (1.3 item 1), audited, with the
   LD_PRELOAD and Capsicum lanes running the corpus.
3. The gate generated from one spec, with `seal except`, and `sae.d.ts` out
   of the same spec (1.3 item 2, 3.2).
4. Same-origin and in-bundle `import` (3.1). **Done.**
5. The reactive surface for pages (3.4) and the AeVG surface (4): the full
   grammar in TS guise, components, bindings, data joins, tweens, events, and
   the transpiler's TypeScript output. **Done**, with demo 1b (`site/camera.ts`) and the
   clock components (`site/clock.ts`); gradients wait on aether-ui (section 4).
6. SQLite v1 (`page-services.md` section 6), which is independent and can
   run alongside.
7. Pixels from a page (8.2) and the first `sae:` library modules (8.1):
   `noise`, `scales`, `easing`, through the loader of 3.1 (**the modules
   are done**; pixels are not). Demos 13 and 15 follow directly.

**Wave 2, trust and files (section 2):**

8. Purpose strings, `license` and `author` (8.4), `saepack` least-privilege checks, ed25519 signing with
   fingerprint and domain-bound keys, reproducible packaging, the Privacy
   screen and runtime revocation through optional seeks.
9. The files powerbox (`page-services.md` section 5), starting with real iOS
   pickers in aether-ui.
10. The page-API parity list of 8.8: `table`, `listbox`, `vlist`, `tree`,
    menus, `alert`, links, commands and keymap.
11. `http.stream`, and sub-page embedding (demo 10's engine, and the
   third-party-component story).

**Wave 3, the gallery and the long tail:**

12. The gallery: demos 1 to 9, 11 and 13 to 16, the tutorial ladder (8.9),
    each with specs on every backend.
13. The sae desktop shell (8.5).
14. The page host in its own process (1.3 item 5).
15. `gfx` and demo 12 (`docs/gpu-pages.md`).

## 8. Mining Tsyne: a map of what to borrow

Tsyne is about 150 examples, 60 ported apps, 40 Cosyne demos, a library
tier, two launchers and a set of design notes. It never shipped, so what it
offers is vision and shape, not lessons; and `not-ours` is ideas only, each
credited by name. Where a ported app's *design* belongs to its original
author under a copyleft licence, the idea is theirs and stays theirs.

### 8.1 A page standard library, served by sae

Cosyne had a pure-TypeScript library tier under its demos: Perlin and FBM
noise, d3-style scales and axes, line charts, markers, zoom-pan, a particle
system, trails, 3D-to-2D projections, symmetry, easing. None of it touches
the system; all of it is what a page author reaches for first. sae's answer
is a **page standard library** at a reserved origin: `import { perlin } from
"sae:noise"`, resolved by the loader of section 3.1 from modules bundled
with sae and hashed, never from the network, usable in browser and app mode
with no capability. First modules: `sae:noise`, `sae:scales`, `sae:easing`
(**built**: `lib/sae/`, hashed into `lib/sae/MANIFEST` at build time,
served by `services/stdlib`; README "Modules" has their API), then
`sae:projections`, `sae:zoom-pan`, `sae:particles`, and `sae:charts`
(axes, line and bar charts as AeVG components). Written fresh, in the
dialect, so they are also the dialect's own test corpus
(`lower/tests/mod/sae_*.ts`). Where speed matters (`perf-gap.md`), a module
can be backed by an Aether verb later without the page noticing.

### 8.2 The missing capability: pixels from a page

**Landed 2026-10-08:** `vg.raster(w, h, rgba, fn?)`, `vg.raster_update(h,
rgba)`, `vg.image(bytes, fn?)`, `ui.image(bytes, fn?)`, with `vg.box` and
`vg.fit` in the block and `vg.raster_size(h)`; budgets 32 MB of pixels and
4096 a side per page, refused with a TypeError; rasters freed with the
page. On aether-ui's new AeVG image element (`vg.image`, all five
backends). The engine side was a labelled workaround (`src/sae_raster.c`)
until contrib.quickjs could read a typed array; since Aether 0.801.0 it is
`quickjs.arg_bytes` (`asks/quickjs-typed-array-bytes.md`, resolved). README
"Pixels from a page".

Terrain, Life, pixel art, waveforms, a Mandelbrot: half of Tsyne's canvas
demos are "a grid of pixels the page computes", and a sae page cannot make
one. aether-ui has `image_from_bytes` (decode PNG, JPEG, GIF, BMP) and a
canvas raster path; pages see neither. Add:

- `vg.raster(w, h, rgba)`: an image element in the scene from a
  `Uint8Array` the page fills, updated in place, hit-testable and
  transformable like any element.
- `ui.image(bytes)`: an encoded image as a widget, and `vg.image` in a
  scene, for photos fetched over `http` or read through the files powerbox.
- Budgets: a raster counts against the page's heap; a per-page cap on total
  raster bytes (say 32 MB of pixels) and on dimensions, refused with the
  usual message.

Typed arrays are already in the page's global surface (`page-services.md`
section 2), so no engine change is needed.

### 8.3 The attacker page

Tsyne had an "attacker app" whose only job was to try to break out (require
the file system, reach the process, read another app's widgets) and print
what happened. sae's escape corpus (section 1.4) is the same idea in sae's
terms, with the twist that each attempt is a spec that must be refused on
every backend, not a console log to read. Credit: Tsyne
`examples/sandbox-breakout`.

### 8.4 Licences travel with the catalogue

Tsyne's launchers register every app in one of two lists, permissive and
copyleft, each entry annotated with its licence and author, and a shell
filters by what it may ship. For sae: `app.json` gains `license` and
`author`, `saepack` requires them (as it will require purpose strings), and
the gallery shows them beside the trust tier of section 2. A copyleft app is
still installable; the catalogue says what it is. Credit: Tsyne
`launchers/all-apps`.

### 8.5 A sae desktop: the shell that shows containment

Tsyne's Desktop (windows, a dock, icons, files, remote control) and
PhoneTop/TabletTop (a phone-style grid) are hosting shells that launch each
app inside a sandboxed view. For sae, the same thing is an app-mode app
built on the sub-page engine of demo 10: it lists installed sae apps with
their trust tier and grants, launches each as a sub-page with its own
runtime and grants, and owns the chrome. On Android it is how one APK would
host many sae apps; on a desktop it makes the containment story visible.
Wave 3.

### 8.6 Games, and sending intent instead of frames

Tsyne's remote-games note planned four rendering tiers and found its sweet
spot in "1b, the scene graph": send the scene once with bindings, then only
state deltas, and let the display animate, hit-test and highlight locally.
That tier is exactly AeVG-TS with bindings (section 4), and its open
question ("does the scene grammar need a wire format for non-TypeScript
servers?") answers itself here: the page *is* the wire format. A server in
any language serves the page once and streams state; the bindings do the
rest. Its ladder (Reversi, the smallest complete game; 2048, which proves
data joins and transitions; chess, which proves drag and legal-move
highlighting) is demo 16, and its tier 3 (a 320x200 framebuffer streamed
from a C engine) is a fun stress test of 8.2 over `http.stream`, not a
product.

### 8.7 Everyday apps worth re-imagining

Ideas, not ports, each named for the capability it would prove:

| Idea | Proves | Ancestor (idea only) |
|---|---|---|
| Kanban board with drag and drop | `on_drag` between containers | Tsyne `kanban-board` |
| Text editor with document tabs | tabs, textarea, files powerbox | Tsyne `text-editor` |
| Terminal | an `exec` grant with a purpose string, app mode only | Tsyne `terminal-emulator` |
| Command palette | aether-ui's commands and keymap, exposed to pages | Tsyne `command-palette` |
| Wizard | navstack | Tsyne `wizard` |
| Theme creator | `styles`, live | Tsyne `theme-creator` |
| Download manager | `http` plus the powerbox `pick_save` | Tsyne `download-manager` |
| Weather viewer | the CORS-alike against a public API | Tsyne `weather-viewer` |
| Photo gallery | a `files` read grant on Pictures, `ui.image` | Tsyne `photo-gallery` |
| Clipboard manager | a `clipboard` capability | Tsyne `clipboard-manager` |
| Appointment scheduler, expense tracker, notes | SQLite v1 | Tsyne examples and ported apps |
| Disk usage map | nothing new: OpenDisk-ae already exists in Aether | Tsyne `grand-perspective`, `disk-tree` |
| Wikipedia reader, DuckDuckGo search | the CORS-alike, and text layout at scale | Tsyne ported apps |
| Sudoku, Connect Four, solitaire, peg solitaire, slider and zip puzzles | AeVG-TS, bindings, `on_drag`, `on_key` | Tsyne ported apps (licences vary, see 8.4) |

### 8.8 The browser demo site, as a parity checklist

Tsyne's browser-mode sample site had pages for alerts, context menus,
dynamic content, forms with POST-redirect-GET, hyperlinks, images, layout,
lists, menus, scrolling, tables, text features, URL fragments and widget
interactions, plus a 404. sae's `site/` has about half. The gap is a list of
page-API additions, each with a page and a spec: `ui.image` (8.2), `table`,
`listbox`, `vlist` and `tree` (aether-ui has them), menus and context menus,
`alert`, a `link(label, url)` widget, URL fragments, and a POST-redirect-GET
flow against `tools/pageserver`. Credit: Tsyne `examples/pages`.

### 8.9 A tutorial ladder

Tsyne's numbered examples climb from hello world through a counter, forms,
a live clock, lists, a multiplication table, a shopping list, tabs, a colour
mixer, a tip calculator, a password generator, a stopwatch, dice, BMI,
rock-paper-scissors and a quiz. sae's site should carry the same ladder,
written fresh in the dialect, each step with a spec: it is the first thing a
new page author reads, and it doubles as the regression suite for the
dialect and the page API.

### 8.10 Tools that write source back

Tsyne's designer edited TypeScript files round trip, and its inspector read
the live widget tree. sae's Playground (demo 10) is the first step, and
aether-ui's inspector already reads the driver surface a sae designer would
use. Later.

### 8.11 What not to take

The npm pitch ("2 million packages") is the opposite of sae: no ambient
modules is the point, and `sae:` plus same-origin `import` replace it. The
gRPC bridge: sae is in-process. The three.js-over-fake-WebGL route:
`docs/gpu-pages.md` says why. Fyne-specific widgets: aether-ui has its own.

## 9. Decisions needed

1. **Coarse clocks in browser mode** (100 µs), full resolution in app mode?
2. **No cookie jar, ever**: page-held tokens are the only credential. Yes?
3. **The CORS-alike header name** (`Sae-Allow-Origin`), and `*` allowed?
4. **`import` syntax**: plain ES `import` with same-origin and hash rules, or
   a sae-specific form? (Plain ES, I think: tsc and editors understand it.)
   **Built as plain ES.**
5. **Signing**: ed25519 with a `.well-known` domain proof, as above?
6. **JSX stays out**, the trailing-block form stays the house style?
7. **The gate spec's format** (one table in a `.md` the generator reads, or a
   small `.ae` DSL)?
8. **The `sae:` library origin**: that name, and the first modules (8.1)?
   **Built as `sae:`** with `noise`, `scales`, `easing`; the name is one
   constant to change.
9. **Raster budgets** (8.2): 32 MB of pixels per page, and a dimension cap?
   (Provisionally yes, as built: 32 MB in total per page, decoded images
   included, and 4096 on either dimension; `tests/spec_raster.ae` pins both.)
10. **Which demo first.** My pick: 4 (the shop) and 1b (the camera), because
   together they exercise every security rule and the whole AeVG surface
   from a corpus file through to bindings, and both are browser pages that
   need no packaging work.
