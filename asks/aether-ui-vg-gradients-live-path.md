# Gradient fills do not paint on vg's live (deferred) path

**From:** sae (wave1/aevg, 2026-10-09). **To:** aether-ui. **Status:** open;
sae skips one spec and paints the camera demo in solid colours meanwhile.

## What happens

A shape filled with a named gradient (`fill("url(#sky)")` after a
`linear_gradient`/`radial_gradient` registered in `defs`) paints nothing, or
its fallback, when the scene is a live `vg(...)` scene on macOS (the deferred
"vg records, window flushes" path in `vg/live.ae`). The same gradient painted
directly on a canvas does paint: `examples/gradspread_demo` is fine, and the
offline loader/transpiler pipeline renders the W3C corpus's gradients (Trajan's
Column's 40 gradients are within parity). So the loss is between the deferred
shape and the canvas call, not in the canvas's gradient support.

## Why sae cares

`saelower --from-svg` turns a corpus SVG into AeVG-TS. `AJ_Digital_Camera`
(public domain, demo 1b) has 175 gradients; with them unpainted its parity
score against librsvg is 33.7 mean absolute error, where the solid-colour
corpus pages score 1 to 4.5. sae emits the camera with `--solid` until this
is fixed, and `tests/spec_aevg.ae` skips its gradient case with this file as
the reason.

## Repro

`site/aevg.ts` in sae, the "gradient fill" block (or any live `vg(...)` scene
with a `defs` gradient and a shape filled `url(#id)`), on macOS; read the
shape's centre pixel back through the driver's `/canvas/{id}/pixel`.

## Related, smaller

- `clip-path=` on a shape and CSS class selectors are registered but have no
  effect on the live path: deferred shapes do not carry the attribute.
- `on_right_click` is stored but never fires: no canvas reports right clicks.
- Group opacity is multiplied into each child rather than composited as one
  layer (overlapping children in a translucent group show through each other).
