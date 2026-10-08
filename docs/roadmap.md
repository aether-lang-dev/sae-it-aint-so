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
| **Same-origin by construction.** A page's `http` reaches its own origin and nothing else. | done | keep, and add the CORS-alike below for the one legitimate cross-origin case |
| **No ambient credentials.** No cookie jar, no `Authorization` sae attaches on a page's behalf. A page that wants to be logged in holds a token in its per-origin `storage` and sends it itself. CSRF cannot exist. | done by absence | write it down as a rule; a test that the browser never adds a header a page did not set |
| **No `Referer`.** Cross-origin requests (once allowed) carry `Origin` only. | n/a | with the CORS-alike |
| **No mixed content.** A page from `https:` may not fetch `http:`. | not checked | refuse, with the page-level reason |
| **Certificate failure is a refusal, not a warning.** The pure TLS client fails closed. No "proceed anyway" in v1: the web's lesson is that warnings get clicked. | done (TLS) | surface the reason in the chrome; show scheme and host as the lock-icon-alike |
| **A page cannot touch the chrome.** The handle floor already makes `set_text` on the address bar throw. | done | keep as a red-team case |
| **A page cannot open windows, frames or pop-ups,** and has no opener. | done by absence | keep |
| **Navigation is a full page load.** Each page has its own runtime, timers, handles, storage scope; nothing survives across except per-origin `storage`. | done | keep |
| **Resource caps per page.** 5 s per entry into JS, 32 MB heap. | done | add: in-flight http (N), timers and frames (M), total storage per origin, and a per-origin memory budget |
| **Coarse clocks in browser mode.** `performance.now()` and frame timestamps rounded (100 µs), as browsers did after Spectre; app mode keeps full resolution. | open question in `page-services.md` section 2 | decide; cheap to do |
| **No fingerprinting surface.** No `navigator`, no device details; `browserContext` exposes the URL and navigation only. | done | keep as a red-team case |
| **No code from anywhere else.** No module loader, no `data:`/`http:` imports. | done | section 3 adds same-origin `import`, hashed; nothing else |

### 1.2 The one cross-origin case: a CORS-alike

A real site has one page origin and a few data origins (a reviews service, a
maps tile server). The web's answer is CORS; its mistake was shipping
credentials with it. sae's version:

- A page may request another origin only if that origin says so: the
  response carries `Sae-Allow-Origin: https://shop.example` (or `*`). sae
  sends `Origin` and no `Referer`, never credentials, and discards the body
  if the header is absent. No preflight: there are no custom headers to
  negotiate, and no cookies to protect.
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

`site/misuse.ts` and `site/vgmisuse.ts` exist. Grow them into
`tests/escape/*.ts`, one page per attempt, each expected to be refused and
logged:

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

1. **Modules within an app or origin.** `import { chart } from "./chart.ts"`
   is refused today. Allow it for the page's own origin (browser) or bundle
   (app), through sae's loader: fetched like a page, lowered, hashed (an
   SRI-alike: an `import` may name the hash it expects), never cross-origin,
   never `data:`. This is the one non-erasure the lowerer takes on: `import`
   and `export` become a sae-provided loader call. Shared components are the
   single biggest ergonomic gap now.
2. **`sae.d.ts`, generated from the gate spec** (section 1.3 item 2). Authors
   get autocompletion and `tsc --noEmit --erasableSyntaxOnly` catches wrong
   calls before a page is served. No grammar change at all; it is the gate's
   second output.
3. **One tagged template, no syntax change:** ``bind`Count: ${n} of
   ${total}` `` is a multi-state `text_bound`. (Not an ``svg`…` `` loader:
   section 4 says why a scene is source, not a string.)
4. **Reactive sugar that already exists one layer down.** aether-ui has
   `computed`, `bind_text`, `bind_value` (two-way), `bind_enabled`,
   `bind_hidden`, `each` with keyed reconciliation and `ui_batch`. Pages see
   only `ui_state`, `ui_set` and `text_bound`. Expose the rest as
   `state(v)`, `computed(fn, ...states)`, `bind(widget, state)`,
   `each(list, key, render)` and `batch(fn)`. This is the Vue-alike half of
   "SVG + Vue": declare once, never call `set_text` again.
5. **Async-first services.** `sqlite`, the files powerbox and `http.fetch`
   are promises; `await` works in handlers already. Add top-level `await`:
   the lowerer wraps a page in an async function when it sees one (a
   one-line desugar, documented).
6. **Keyboard and pointer in pages**: `on_key`, `on_drag`, `on_scroll`,
   `on_hover` exist in aether-ui and are needed by half the demos below.
7. **Non-goals, deliberately.** No JSX: it is a real transform, and the
   trailing-block form is the house style (`tsyne-migrated.md`, "Pages stay
   declarative"). No `enum` or decorators: `tsc --erasableSyntaxOnly` refuses
   them too, and the dialect stays "what tsc erases".

## 4. AeVG, alive: the SVG model as TypeScript

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
| 1b | **The camera you can operate.** `AJ_Digital_Camera` from the corpus (public domain; parity "good"), transpiled once to AeVG-TS, then made real: turn the mode dial (a group rotation bound to state), press the shutter (a tween and an LCD flash), zoom the lens, the LCD text bound to state. The "take one of those and make it interactive" demo. | the full grammar in TS guise, the transpiler's TS output, bindings, tweens | 4 | the W3C/CVG corpus |
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

Corpus files carry their own licences: `AJ_Digital_Camera` says public
domain; `USStates` (a map worth a data-join demo) is GFDL and GPL from
Wikimedia; the small W3C test shapes state none. Check before a demo is built
on one; aether-ui's rule for Trajan's Column and Tetris was a provenance
block at the top of the file.

The demos ship as a gallery: `site/` grows an index page that launches each
(Cosyne's demo launcher is the model), and the app demos are packages the
installer can read before it says yes.

## 6. Build order

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
4. Same-origin and in-bundle `import` (3.1).
5. The reactive surface for pages (3.4) and the AeVG surface (4): the full
   grammar in TS guise, components, bindings, data joins, tweens, events, and
   the transpiler's TypeScript output.
6. SQLite v1 (`page-services.md` section 6), which is independent and can
   run alongside.

**Wave 2, trust and files (section 2):**

7. Purpose strings, `saepack` least-privilege checks, ed25519 signing with
   fingerprint and domain-bound keys, reproducible packaging, the Privacy
   screen and runtime revocation through optional seeks.
8. The files powerbox (`page-services.md` section 5), starting with real iOS
   pickers in aether-ui.
9. `http.stream`, and sub-page embedding (demo 10's engine, and the
   third-party-component story).

**Wave 3, the gallery and the long tail:**

10. Demos 1 to 9 and 11 as the gallery, each with specs on every backend.
11. The page host in its own process (1.3 item 5).
12. `gfx` and demo 12 (`docs/gpu-pages.md`).

## 7. Decisions needed

1. **Coarse clocks in browser mode** (100 µs), full resolution in app mode?
2. **No cookie jar, ever**: page-held tokens are the only credential. Yes?
3. **The CORS-alike header name** (`Sae-Allow-Origin`), and `*` allowed?
4. **`import` syntax**: plain ES `import` with same-origin and hash rules, or
   a sae-specific form? (Plain ES, I think: tsc and editors understand it.)
5. **Signing**: ed25519 with a `.well-known` domain proof, as above?
6. **JSX stays out**, the trailing-block form stays the house style?
7. **The gate spec's format** (one table in a `.md` the generator reads, or a
   small `.ae` DSL)?
8. **Which demo first.** My pick: 4 (the shop) and 1b (the camera), because
   together they exercise every security rule and the whole AeVG surface
   from a corpus file through to bindings, and both are browser pages that
   need no packaging work.
