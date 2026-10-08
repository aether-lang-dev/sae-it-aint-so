# contrib.quickjs: read a typed array's bytes

**From:** sae (wave1/raster, 2026-10-08). **Aether:** 0.790.0 / 0.791.0.
**Status:** worked around in sae (`src/sae_raster.c`); needs a contrib
addition.

## Motivation

sae's pages make pixels (`vg.raster(w, h, rgba)`: Life, terrain, a decoded
photo for `vg.image` / `ui.image`). The natural carrier is a `Uint8Array`,
which the engine already gives every page (`docs/page-services.md` section
2), but contrib.quickjs's surface has no way for the host to see its bytes:
`arg_string` goes through `JS_ToCString` (UTF-8, and a typed array
stringifies as "1,2,3"), and `get_index` one element at a time is 65 536
handle allocations for a 128x128 raster per frame.

## What sae does meanwhile

`src/sae_raster.c` mirrors the first three fields of `AeQjs` (`rt`, `ctx`,
`vals`) to reach the handle's `JSValue`, then uses QuickJS's own
`JS_GetTypedArrayType` / `JS_GetTypedArrayBuffer` / `JS_GetArrayBuffer`.
The mirror is proved at first use (`sae_qjs_u8_self_check` reads a known
array back) and the page API refuses rasters if the proof fails, so a
layout change in contrib cannot make sae read the wrong memory, only stop
it reading any. It needs `quickjs.h` on the include path
(`.build.ae`: the dev tree's `contrib/quickjs/amalgamation`, or the
installed `share/aether/contrib/quickjs/amalgamation`).

## Ask

In `contrib/quickjs/module.ae`, something like:

```
// The bytes of a Uint8Array / Uint8ClampedArray (a view's own window of
// its buffer): (pointer into the engine's buffer, byte count), (null, -1)
// when the value is not one. Valid until JS next runs: copy it.
bytes_of(q: ptr, h: int) -> (ptr, int)
arg_bytes(q: ptr, args: int, i: int) -> (ptr, int)
```

and, for the other direction (an `http` body or a file handed to a page as
bytes rather than a string), `new_uint8array(q: ptr, data: ptr, n: int) ->
int`. With `bytes_of` in a release, `src/sae_raster.c` goes and
`arg_bytes_` in `src/sae_host.ae` becomes one call.
