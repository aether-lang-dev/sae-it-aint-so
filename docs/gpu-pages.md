# GPU pages: a design sketch

Status: thinking, with a first slice built. Written 2026-10-03 to start the
discussion of how a sae page reaches the GPU: Vulkan, Metal and Direct3D 12
through Aether's `contrib` modules, and 3D scenes through ae3d.

**Built so far (2026-11-27), shaped by three.js rather than by the builder
below:** `gfx.scene`, `gfx.submit`, `gfx.view`, `gfx.stats`, `gfx.free`
(README "3D scenes"). A page hands over one buffer a frame in ae3d's
`ae3d.batch` layout (aether-lang-dev/ae3d#1102), which three.js's
`AeRenderer` writes (aether-lang-dev/three.js, branch `sae-port`,
`PORT.md`). sae checks it whole, holds it to the page's budgets and frees it
with the page. sae does not link ae3d: **sae-gfx**, a GPU helper process,
draws it (below), and `gfx.view` shows the picture in the page. three.js's
README cube runs on it, its faces the colours three.js's own maths says
(`sae-port/cube/spec_cube.ae`). Still open: containment of the helper (a
process sandbox that can hold a GL driver), Vulkan or Metal, and whether the
builder API is wanted beside the batch.

## The GPU helper (sae-gfx)

Paul's decision (2026-11-26): ae3d runs in a process of its own, not linked
into sae. sae's binary stays small, GLFW never meets GTK4 or AppKit in one
process, and a GPU or driver crash ends the pages' 3D, not the browser.

| Piece | Where | What |
|---|---|---|
| The helper | `gfx/main.ae`, built by `gfx/build.sh` into `target/build/bin/sae-gfx` | The one part of sae that imports ae3d: one OpenGL context offscreen (CGL on macOS, a hidden GLFW window's elsewhere), an `ae3d.batch` and its canvas per scene, each picture read back as RGBA |
| Its process and protocol | `services/gfx` | Started through `services/backend` (still the one place sae starts a program) on a socket pair, `std.ipc` frames both ways; every message it sends held to the protocol |
| The pages' scenes | `src/sae_host.ae`, wave1/gfx | Which scene the helper draws, what is queued for it, its pictures into each `gfx.view`, timeouts, teardown |

`gfx/build.sh` points `gfx/ae3d` (a symlink, not committed) at an ae3d
checkout: `../ae3d`, or `AE3D_DIR` (the #1102 worktree until that merges).
sae finds the helper beside itself, or at `SAE_GFX_PROGRAM`.

### The protocol (version 1)

One `std.ipc` frame a message: a header line of words, `\n`, then the body.

| From | Message | Answer |
|---|---|---|
| helper, first | `hello sae-gfx 1 <what draws>` (or `hello sae-gfx 1 none`, `err 0 <why>`, and it exits) | |
| sae | `open <id> <w> <h>` | `ok <id>` or `err <id> <why>` |
| sae | `submit <id> <draw 0\|1>\n<an ae3d.batch>` | with draw 1, a picture; `err <id> <why>` if refused |
| sae | `draw <id>` | a picture of the scene as it stands |
| sae | `free <id>`, `bye` | none |
| helper | `pixels <id> <frame> <w> <h> <ms>\n<w*h*4 bytes, RGBA rows, top first>` | |

Both sides check everything. The helper answers a header, size or id out of
range, or a batch `ae3d.batch` refuses, with `err` and nothing changed, and
goes on; a frame over 16 MB or a failed channel ends it. sae checks each batch
before it sends it (the budgets below), and holds the helper to the
protocol: a first message that is not its hello, a message it does not know,
or a picture of the wrong size stops the helper, and its scenes are lost.

**One picture in flight a scene.** A batch that comes while a picture is
asked for is sent with draw 0 (its meshes are kept) and, once the picture
comes, `draw` asks for the latest. A page faster than the GPU drops
pictures; it never falls behind.

### The swap to a shared buffer

Pixels go in frames now. When std.ipc has its shared-memory buffer (a
separate Aether batch, not released), the change is two messages and the
copy:

- `open <id> <w> <h>` carries a descriptor, sent with `ipc.send_fd` on the
  frame (services/frames' `put_fd`; descriptors only go down, sae to helper),
  of a buffer sae made of `2 * w * h * 4` bytes, two slots.
- `pixels ...\n<bytes>` becomes `ready <id> <frame> <slot> <ms>` with no
  body: the helper wrote the picture into that slot, and does not write it
  again until sae's next `submit` or `draw` (which says the slot is free,
  as it does now by asking).
- sae's `gfx_answer_` points the view's image at the slot (`vg.image_pixels`,
  which borrows) instead of copying.

Nothing else moves: the flow control, timeouts and teardown are the same,
and so is `gfx.view`.

### Not blocking the page

Nothing waits inside a page's entry. `gfx.scene`, `gfx.submit` and
`gfx.free` check and queue a frame on the browser's list; `gfx_tick_`, a
kernel tick that runs only once no entry does (`b.entry_depth`), starts the
helper when a scene needs it, sends what is queued (std.ipc's frame writer,
never a write that waits, the 5 s bound), reads its answers a tick at a
time, and copies each picture into its view and repaints it.

### When it dies or hangs

A picture not back within 3 s is a hung helper, killed at once. A helper
that dies, hangs or breaks the protocol loses every scene it drew: the
browser says so once, `gfx.stats(scene).error` says why, and `gfx.submit`
on a lost scene throws it. The browser goes on. The next `gfx.scene` starts
a new helper. With no page holding a scene for 2 s the helper is told `bye`
and stopped; a page's scenes go with the page.

### Containment

| | process sandbox | the helper's own lockdown | runs |
|---|---|---|---|
| Linux | no: Aether's refuses the executable memory a GL driver needs | yes | with `--uncontained-gfx` |
| macOS | no: Aether holds no child there | yes | with `--uncontained-gfx` |
| FreeBSD | no: likewise | yes | with `--uncontained-gfx` (not built or run there yet) |
| Windows | no socket pair in std.ipc | | no |

The plan was `sandbox.spawn_socket` on Linux, held to the GPU's device nodes
(`/dev/dri/`), X's socket folder and cookie, the system's libraries read only
and a few driver variables (`services/gfx`'s `grants_linux`). Run, it does
not draw: Aether's sandbox preload refuses an anonymous executable mapping
and adding execute to a mapping (`AETHER_DENIED: native
mmap_exec_anonymous`, `native mprotect_exec`), with no grant that lifts it,
and libglvnd's dispatch stubs and llvmpipe's JIT both need one. The helper
dies on its first GL call (`spec_gfx_service`'s Linux case holds that, so it
says when it changes). Two smaller things showed on the way: X's abstract
socket is outside a Landlock-scoped child (the socket's path in `DISPLAY`
works), and the X cookie (`XAUTHORITY`) must be granted.

So the helper runs only when the person starts sae with
`--uncontained-gfx`, said at start and at each launch of it; without it a
scene is checked and counted, not drawn, and `gfx.stats().error` says why.
On every platform the helper locks its own calls down once its GL context is
made (`sandbox.enforce` with no grants: no file, program, variable or
connection from its Aether code), which holds its own code, not the
driver's C. Its environment is only the display and driver variables sae
passes. The next step is Aether's: a grant for executable memory (a JIT
grant), then the kernel starts the helper with `grants_linux`.

### Tests

- `tests/spec_gfx_service.ae` (no window; Linux needs a display, Xvfb is
  fine): three.js's README cube from its own batches
  (`tests/gfx/cube_dump.txt`, made by three.js's `readme_cube.js`) held to
  three.js's maths at each face to 2/255, the frames differing; a malformed
  batch, a draw of a mesh it has not, a message that is not one and an open
  of no size each refused with the helper still drawing; the helper killed
  and a new one drawing; its lockdown refusing a file it read before it; on
  Linux, the process sandbox case above.
- `sae-port/cube/spec_cube.ae` in three.js (`SAE_TEST_FLAGS=--uncontained-gfx
  tests/run_spec.sh <spec> <page>`): the page turning the cube, every
  frame drawn, two poses held to three.js's maths at the view's pixels, the
  pictures differing, the helper killed mid-run (the page told, the page
  going on), and a new scene drawn by a new helper.

Verified 2026-11-27: on cachyos (Mesa 26.3.1 llvmpipe under Xvfb, not the
Intel GPU: a hidden GLFW window needs an X display, and only Xvfb's was
ours to use) both specs; on macOS (OpenGL 4.1 over Metal, CGL, no window)
`spec_gfx_service`.

## The constraint that shapes everything

A page is untrusted code from a URL, running on QuickJS (contrib.quickjs): a
engine, about 2x slower than C. Two things follow.

1. **The page describes; native code does the work.** This is already how
   `ui` and `vg` work: a widget costs ~100 µs natively and the JS that asks
   for it under 1 µs (`spike-results.md`). A GPU API in the same spirit hands
   the page a scene to describe and a few callbacks to steer it, and keeps
   per-vertex, per-draw and per-frame work in Aether.
2. **Raw Vulkan is not a page API.** A page that can record command buffers
   can hang the GPU, read uninitialised memory, exhaust device memory, or
   crash a driver. The web's answer, WebGPU, is a validating layer between
   page and driver with resource limits and device-loss isolation. sae needs
   the same properties, whichever surface it picks.

Tsyne took a different road (`not-ours/tsyne/trine`): three.js running in
Node against a fake WebGL2 whose calls cross the bridge to OpenGL. That
needs a full-speed JS engine and a WebGL-shaped API with ~150 entry points.
sae has neither, and does not want the second.

## Three layers, and who owns each

| Layer | Owner | What it is |
|---|---|---|
| Device | Aether `contrib.vulkan` / `contrib.metal` / `contrib.d3d12` | One shared shape across APIs: devices, targets, pipelines, textures, compute, readback; `available()` instead of failing to load (`aether/docs/gpu.md`) |
| Scene | ae3d | Game objects, meshes, PBR materials, lights, camera, sky, physics, crowds; Vulkan and OpenGL renderers at parity |
| Page | sae | Host functions a page calls, behind the page veto, with per-page budgets and teardown |

sae should not grow its own renderer. The page layer is bindings, limits and
lifetimes; the drawing is ae3d's and the device is Aether's.

## The page API: `gfx`, a scene builder

Same shape as `ui` and `vg`: builders with trailing blocks, modifiers that act
on the innermost open thing, handles returned for later changes.

```ts
const { scene, object, cube, sphere, plane, material, light, camera, on_update, set_position } = gfx;

scene(640, 360, () => {
  camera([0, 2, 6], [0, 0, 0], 60);
  light("directional", [-1, -2, -1], "#ffffff", 3.0);
  plane(20, () => material("#556655", 0.0, 0.9));
  const c = object("Spinner", cube(1), () => {
    material("#c44", 0.2, 0.4);           // colour, metallic, roughness
    on_update((dt: number) => spin(c, dt));
  });
});
```

What the binding does:

- `scene(w, h, fn)` creates an ae3d engine bound to an offscreen target and a
  panel in the page's widget tree, presented through aether-ui's native view
  (`aether-ui/tests/gpuview_demo`; contrib.vulkan's swapchain over a window
  someone else owns). The page never sees a window.
- Shapes and materials are ae3d calls made at build time. A page's object
  graph lives in the engine, not in JS.
- `on_update(fn)` is the page's only per-frame code. ae3d calls it from its
  `update` phase with the frame's delta. Each call is a JS call (a few µs),
  so a page should keep these to a handful; a page that wants a thousand
  moving things uses an ae3d system (a crowd, particles, physics) and
  configures it, rather than scripting each thing.
- Changes after build (`set_position(h, ...)`, `set_material(h, ...)`) go
  through handles, as `vg.set_fill` does.

What it deliberately leaves out, at first:

- **Shaders.** A page-supplied shader is code for the GPU. Each backend wants
  a different language (SPIR-V, HLSL, MSL), and accepting one safely needs a
  validator in front of the driver. Materials are parameters, not programs,
  until there is a shader story worth trusting.
- **Asset loading from paths.** ae3d loads glTF and textures from files. A
  page names assets by URL relative to the page; the kernel fetches them
  (as it fetches pages) and hands ae3d bytes. No `gfx` function takes a path.
- **The agent channel**, the editor and ae3d's networking. Those are
  tools for the program's author, not for the page.

## A second tier, later: `gpu`, WebGPU-shaped compute

For pages that need computation more than a scene (image filters,
simulations, plotting large data), a small tier over `contrib.*`'s compute:
buffers, a compute pipeline from a validated shader, dispatch, and an
asynchronous readback. WebGPU's object model is the right model to copy:
validation on every call, limits queried up front, device loss as an event
the page can handle. It waits on the shader question above.

## Safety: the page veto, budgets, teardown

- **The page veto** (`src/sae_host.ae`) extends to every `gfx` host
  function. ae3d's file loaders, the agent channel and the engine's window
  are on the hide list from the start, and `tests/check_page_veto.sh` covers
  the new functions without change, since they are registered at run time.
- **Budgets per page**: objects, triangles, texture bytes, lights, and
  `on_update` time per frame. Over budget is a thrown error, like calling a
  shape outside `vg.scene`. The numbers are policy, set by the browser.
- **Teardown on navigation.** Leaving a page frees its engine, its target
  and every handle the page held. sae's vg pages leaked about 20 KB per
  visit until it was measured (`leaks`, 2026-10-03); a GPU page that leaks
  holds device memory. A spec that visits a `gfx` page fifty times and
  checks the process's footprint is part of the first slice, not later.
- **Device loss** ends the page, not the browser: the page shows an error,
  as a page that throws does, and the next page gets a fresh device.

## Testing

saedriver already reads vg canvas pixels. For `gfx` the equivalent is a
frame readback: capture the finished frame and read pixels or regions of it,
as ae3d's agent channel does (`frame.capture`, `frame.pixel`,
`frame.region`, and `frame.hold` / `frame.diff` against a reference). The first spec: a page with one red cube on
a grey plane, the pixel at the cube's centre is red, at the corner grey, and
after an `on_update` that moves the cube, the centre is grey.

## Open questions

- **ae3d inside another app's loop.** `engine_run` owns its loop and its
  window today. A page needs ae3d driven a frame at a time from aether-ui's
  timer (or a display link), drawing into a target sae presents. Is there,
  or should there be, an `engine_frame(e, dt)` entry point and an
  offscreen-target mode? That is a question for ae3d's maintainer.
- **Which renderer.** ae3d's Vulkan path is the default; on macOS that
  means MoltenVK installed. Its OpenGL 4.1 path is at parity and ships with
  macOS. A browser can't ask its users to install MoltenVK, so on macOS the
  OpenGL path, or Metal once ae3d has it, is likely the practical default.
- **Engine per page or shared.** One engine per `scene()` is simplest and
  makes teardown obvious; a shared device with per-page engines saves start
  time. Start with one per scene and measure.
- **Binary size.** ae3d is large: answered by the helper, a program of its
  own (`sae-gfx`), which sae never links.

## First slice

1. ae3d: a frame-at-a-time entry point and an offscreen target (an ask in
   ae3d's `asks/`, if Nic agrees with the shape).
2. sae: `gfx.scene`, `object`, `cube`/`sphere`/`plane`, `material`,
   `light`, `camera`, `on_update`, `set_position`. Behind the veto, with
   budgets for objects and triangles.
3. A `site/gfx.ts` demo and specs: the pixel checks above, the throw when a
   shape is outside a scene, and the fifty-visit footprint check.
