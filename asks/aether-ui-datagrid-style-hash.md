# Ask (aether-ui): a datagrid cell's style can change without being redrawn

## What happens

`_datagrid_style` re-applies `cell_style` to a shown cell only when the
style string's hash changes (`g.style_hash`). `_datagrid_hash` is djb2
modulo 2^31 - 1:

```aether
h = (h * 33 + string.char_at(s, i)) % 2147483647
...
if h <= 0 { h = 1 }
```

Aether's `int` is 32-bit, so `h * 33` overflows once `h` passes 65 million
(after five or six characters). Most style strings then come out negative,
and every negative hash becomes 1: two different styles have the same hash,
and the grid keeps drawing the first.

Measured (aether 0.801.0, `ae run`):

```
hash("text-align: end; background: #ffebee") = -1076972376  -> 1
hash("text-align: end; background: #e8f5e9") = -1170673247  -> 1
```

Found by sae's spreadsheet (demo 18): after a sort, a conditional style
turned a cell from red to green; the page's `cell_style` gave the new style,
and the grid went on showing red, through any number of refreshes.

## The fix

A modulus small enough that `h * 33 + 255` stays inside a 32-bit int
(33554393 is the largest prime below 2^25):

```diff
 // A string's hash (djb2, kept positive); never 0, so 0 means "none yet".
+// The modulus keeps h * 33 + a byte inside a 32-bit int: with 2^31 - 1 it
+// overflowed, most style strings came out negative, and every negative one
+// was 1, so a cell's style looked unchanged when it changed.
 _datagrid_hash(s: string) -> int {
     h = 5381
     n = string.length(s)
     i = 0
     while i < n {
-        h = (h * 33 + string.char_at(s, i)) % 2147483647
+        h = (h * 33 + string.char_at(s, i)) % 33554393
         i = i + 1
     }
     if h <= 0 { h = 1 }
     return h
 }
```

Verified in sae with the patch applied to `../aether-ui` at e50baa53: every
`spec_sheet` test passes, including the sort whose conditional colours
change in place ("Sort Z→A orders the selection's rows ... formats and
conditional styles with them"); without it, that test's colour checks fail.

## Once it lands

Bump `AETHER_UI_REF` in sae's `pins` to the commit that has it.
