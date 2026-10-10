# Text ignores its transform on vg's live (deferred) path

**From:** sae (demo 18, the spreadsheet's resizable columns, 2026-10-10).
**To:** aether-ui. **Status:** OPEN, with a patch below, verified in sae.

## What happens

A text shape inside a translated group (or with a transform of its own) is
drawn as if it had none, on a live `vg` scene. Rects, lines and circles in
the same group move with it. sae's scene record pushes the composed transform
onto every element alike (`aevg/module.ae`, `push_transform_`, through
`element.element_set_transform`), so the transform reaches the text element
and is lost after that.

sae's spreadsheet draws each column as a group translated to its left edge,
so that dragging a header border slides the columns after it. Without this
fix every column's text, and every header letter, piles up at the left of
column A (screenshots in the session that found it; `tests/spec_sheet.ae`'s
ink checks below fail three times).

## Where

`vg/module.ae`, the deferred flush. `_flush_one_body` sends text (kind 4) to
`flush_text` before `apply_cached_style`, which is where every other shape's
cached transform is folded into its attrs as `transform`. `flush_text` (and
`_emit_text`, its shadow copy) rebuild the text as a one-element
`<svg><text ...>` and re-emit fill, stroke, font size and anchor, but not the
transform, so `shapes.shape_text`'s `maybe_push_transform` finds none.

## The fix

Emit the cached transform as the rebuilt `<text>`'s `transform` attribute, in
both places, through one helper. Against aether-ui 4775cdba (sae's pin):

```diff
diff --git a/vg/module.ae b/vg/module.ae
index 15bde29..4cce913 100644
--- a/vg/module.ae
+++ b/vg/module.ae
@@ -2138,6 +2138,16 @@ _text_of(pend: *VgPending) -> string {
     return pend.content
 }
 
+// The element's transform (its own composed with its groups') as a <text>
+// attribute, or "": shape_text pushes it, as the other shapes get theirs
+// from apply_cached_style. Without it, text in a translated group stayed
+// where it was made.
+_transform_attr(pend: *VgPending) -> string {
+    tf = element.element_last_transform(pend.element)
+    if string.length(tf) == 0 { return "" }
+    return string.concat("' transform='", tf)
+}
+
 // Emit one <text> at (x,y) in `fill`, reusing pend's font/anchor/content.
 _emit_text(ctx: ptr, be: ptr, pend: *VgPending, x: float, y: float, fill: string) {
     s = "<svg><text x='"
@@ -2154,6 +2164,7 @@ _emit_text(ctx: ptr, be: ptr, pend: *VgPending, x: float, y: float, fill: string
         s = string.concat(s, "' text-anchor='")
         s = string.concat(s, pend.anchor)
     }
+    s = string.concat(s, _transform_attr(pend))
     s = string.concat(s, "'>")
     s = string.concat(s, _text_of(pend))
     s = string.concat(s, "</text></svg>")
@@ -2206,6 +2217,7 @@ flush_text(ctx: ptr, be: ptr, p: ptr) {
         s = string.concat(s, "' text-anchor='")
         s = string.concat(s, pend.anchor)
     }
+    s = string.concat(s, _transform_attr(pend))
     s = string.concat(s, "'>")
     s = string.concat(s, _text_of(pend))
     s = string.concat(s, "</text></svg>")
```

## How it was verified

In sae, on Linux (GTK4 build, Xvfb), with the patch applied to `../aether-ui`
and sae-driver rebuilt:

- `tests/spec_sheet.ae` passes 10/10. Its ink checks look for text pixels
  where a column's text should be: B1's "Qty" in column B and C1's "Price"
  in column C after the paste, and "Price" at its new place after column B
  is dragged wider. Without the patch those three checks fail (8 passing, 3
  failing), and with it they pass.
- `spec_algos` passes either way. `spec_aevg` (4/37), `spec_camera` (3/14) and
  `spec_aevg_parity` (0/10) fail on this Linux build with and without the
  patch, test for test the same, so the patch changes none of their results;
  those failures are this environment's, not the patch's.

A test on aether-ui's side would fit `vg/test/test_vg.ae` (which already
checks `element_last_transform` on a text in a translated group): render a
live scene with a text in `g(transform="translate(100 0)")` and check its ink
lands past x = 100.

## What sae does until it lands

sae pins aether-ui at 4775cdba, which lacks the fix, so on that pin the
spreadsheet's text stays in column A and `spec_sheet`'s three ink checks fail.
Bump `AETHER_UI_REF` in `pins` to the commit that carries the fix.
