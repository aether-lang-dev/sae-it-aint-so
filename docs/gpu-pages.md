# GPU pages: a design sketch

Status: thinking, not built. Written 2026-10-03 to start the discussion of
how a sae page reaches the GPU: Vulkan, Metal and Direct3D 12 through
Aether's `contrib` modules, and 3D scenes through ae3d.

## The constraint that shapes everything

A page is untrusted code from a URL, running on mquickjs-ae: an ES5-subset
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
  the new functions without change, since it reads them from the ROM table.
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
- **Binary size.** ae3d is large. `gfx` should be a build option of sae
  (`sae` and `sae-gfx`), not something every build carries.

## First slice

1. ae3d: a frame-at-a-time entry point and an offscreen target (an ask in
   ae3d's `asks/`, if Nic agrees with the shape).
2. sae: `gfx.scene`, `object`, `cube`/`sphere`/`plane`, `material`,
   `light`, `camera`, `on_update`, `set_position`. Behind the veto, with
   budgets for objects and triangles.
3. A `site/gfx.ts` demo and specs: the pixel checks above, the throw when a
   shape is outside a scene, and the fifty-visit footprint check.
