# contrib.quickjs: Array.prototype.find frees an element twice when interrupted

**From:** sae (agent qjs-heap, 2026-11-21). **Aether:** 0.931.0 (contrib.quickjs
on quickjs-ng 0.18.0). **Status:** open. sae guards against it meanwhile (below).

## What happens

quickjs-ng 0.18.0's `js_array_find` (behind `find`, `findIndex`, `findLast`
and `findLastIndex`) polls the interrupt at the top of each step:

```c
for(; k != end; k += dir) {
    if (js_poll_interrupts(ctx))
        goto exception;          /* frees val */
    ...
    JS_FreeValue(ctx, val);      /* the step's element, released */
    JS_FreeValue(ctx, index_val);
}
...
exception:
    JS_FreeValue(ctx, index_val);
    JS_FreeValue(ctx, val);      /* the previous step's element, again */
```

`val` keeps the previous element after it is released, so when the
interrupt handler stops JavaScript at the top of step k (k >= 1), the
exception path releases element k - 1 a second time. The ownership rule
broken: a `JSValue` released with `JS_FreeValue` must not be released again;
the variable that held it must be cleared (`val = JS_UNDEFINED`), as
`js_array_every` and `js_array_reduce` do. An element only the array holds
goes to refcount 0 and is freed while the array still points at it; the
next GC dies in `gc_decref_child` (`JS_REF_COUNT(p) > 0`), or a read of it
in `find_own_property`. Only an interrupt reaches it (a deadline, a cancel
or a stop cell): no exception a script can throw lands there.

sae runs every page entry under a deadline (5 s, `SAE_PAGE_TIME_MS`), so a
long `find` in a page is stopped there now and then. spraedsheet's
`spec_sheet` (its sheet code calls `find` in its grid's cell functions)
crashed in 3 of 4 runs on a loaded host. Under AddressSanitizer with a
300 ms limit (sae AGENTS.md, "A heap-checking lane") the free and the use:

```
ERROR: AddressSanitizer: heap-use-after-free ... in JS_FreeValueRT
    #1 js_array_finalizer   #8 JS_CallInternal (freeing a frame's locals)
freed by thread T0 here:
    #9 JS_FreeValue  #10 js_array_find (quickjs-amalgam.c:56518, the exception path)
previously allocated by: JS_NewObject in a callback js_array_every ran
```

Upstream quickjs-ng fixed it on master after 0.18.0: e22ce4de43 "Clear
Array.find value ownership after release (#1826)", 2026-11-02. No release
carries it yet (latest v0.18.0).

## Repro: contrib.quickjs alone, no sae

```aether
// A find over objects, run until a 20 ms deadline stops it, then a check
// that every object is still the one the array holds.
import contrib.quickjs

main() {
    q = quickjs.runtime(65536, 0)
    s, e1 = quickjs.eval(q, "var a = []; for (var i = 0; i < 200000; i++) a.push({ n: i }); 0", "setup.js")
    if e1 != "" { println(e1); return }
    quickjs.release(q, s)
    // The callback has no loop, so the only interrupt polls are find's own,
    // at the top of each step: the one that fires is there. (The engine
    // reads the clock every 10,000 polls: an array length that is a
    // multiple of that can land every check on step 0, which is harmless.)
    quickjs.set_deadline_ns(q, quickjs.now_ns() + 20000000)
    _f, e2 = quickjs.eval(q, "for (;;) a.find(function (o) { return o.n < 0; })", "find.js")
    println("find: ${e2}")
    quickjs.clear_deadline(q)
    quickjs.clear_interrupted(q)
    // New objects take the freed one's memory; then each element is checked.
    v, e3 = quickjs.eval(q, "var fresh = []; for (var j = 0; j < 1000; j++) fresh.push({ n: -1 }); var bad = -1; for (var i = 0; i < a.length; i++) { if (a[i].n !== i) { bad = i; break; } } bad", "check.js")
    if e3 != "" { println("check: ${e3}"); return }
    bad = quickjs.to_int(q, v)
    quickjs.release(q, v)
    if bad < 0 { println("intact") } else { println("corrupt: a[${bad}] is no longer the object it held") }
    quickjs.dispose(q)
}
```

Aether 0.931.0, every run: macOS arm64 prints `corrupt: a[114993] ...` (the
index varies) and aborts in `gc_decref_child` at dispose; Linux x86_64
(ae-x64, gcc 11) aborts in `gc_decref_child` before the check prints. With
the patch below: `intact`, exit 0, 3 of 3 on ae-x64.

## Proposed patch

quickjs-ng's own fix, on the pinned 0.18.0 amalgamation (or bump the lock
to the first release that has e22ce4de):

```diff
--- a/contrib/quickjs/amalgamation/quickjs-amalgam.c
+++ b/contrib/quickjs/amalgamation/quickjs-amalgam.c
@@ -56505,6 +56505,7 @@
             }
         }
         JS_FreeValue(ctx, val);
+        val = JS_UNDEFINED;
         JS_FreeValue(ctx, index_val);
     }
     JS_FreeValue(ctx, obj);
```

The amalgamation is fetched, not committed, so the patch would live beside
it (applied by `scripts/fetch-quickjs-amalgamation.sh` after the checksum),
with the repro above as a test in `contrib/quickjs/test_quickjs.ae`. The
other 20 interrupt polls in 0.18.0 were read for the same pattern
(instanceof, for-in, isPrototypeOf, __lookupGetter__, every/some/forEach/
map/filter, reduce, includes, indexOf, lastIndexOf, the interpreter's
jumps, construct): each either clears what it released or releases only
the current value; `find` is the only one.

## What sae does meanwhile

`src/sae_prelude.js` defines `find`, `findIndex`, `findLast` and
`findLastIndex` on `Array.prototype` in JavaScript, before a page runs: a
loop there is stopped by the interpreter, which frees what it holds once.
The comment there names this ask; remove it when contrib.quickjs carries
the fix. `tests/spec_interrupted.ae` ("a find the limit stopped between two
elements leaves its array whole", site/interrupted.ts) fails on the native
find (`items: corrupt at 9649`) and passes with the guard.

## A second, optional proposal: a handle check for debugging hosts

Finding this meant first ruling out sae's own handles (a host function
releasing one twice looks the same in the GC). A build switch in
`aether_quickjs.c` made that a one-run check: freed handle slots wait in a
FIFO of 200,000 before reuse, and using, releasing or (in `dispatch_`)
finding stale a handle that is not held aborts, naming it. Two of sae's
spec_sheet runs under it (page limits of 300 ms and 3 s, hundreds of
interrupted entries each) reported no stale handle before the find fault. The patch
used (unconditional here; upstream it would sit behind a define such as
`QJS_HANDLE_CHECK`):

```diff
--- a/contrib/quickjs/aether_quickjs.c
+++ b/contrib/quickjs/aether_quickjs.c
@@ -73,6 +73,7 @@
     JSValue exc;            /* ... and as the value itself, for qjs_rethrow */
     int has_exc;
     char *scratch;          /* the last string handed out */
+    int *qring_; int qhead_, qcount_;   /* HEAPCHECK quarantine */
 } AeQjs;
 
 /* Monotonic nanoseconds: the clock deadlines are on. The same sources as
@@ -162,14 +163,34 @@
 
 static int valid_(AeQjs *q, int h) { return q && h > 0 && h < q->cap && q->used[h]; }
 
-static JSValueConst get_(AeQjs *q, int h) { return valid_(q, h) ? q->vals[h] : JS_UNDEFINED; }
+/* HEAPCHECK (a diagnostic build): a freed slot waits in a FIFO of QN before
+ * it is handed out again, and a stale handle (h > 0, not held) is fatal. */
+#include <stdio.h>
+#define QN 200000
+static void hc_die_(const char *what, int h) {
+    fprintf(stderr, "HEAPCHECK: %s of stale handle %d\n", what, h);
+    fflush(stderr);
+    abort();
+}
+#define HC_CHECK(q, h, what) do { if ((h) > 0 && !valid_((q), (h))) hc_die_((what), (h)); } while (0)
+
+static JSValueConst get_(AeQjs *q, int h) { HC_CHECK(q, h, "use"); return valid_(q, h) ? q->vals[h] : JS_UNDEFINED; }
 
 /* Remove h from the table without freeing: the caller owns the value now. */
 static JSValue take_(AeQjs *q, int h) {
     if (!valid_(q, h)) return JS_UNDEFINED;
     JSValue v = q->vals[h];
     q->used[h] = 0;
-    q->free_list[q->nfree++] = h;
+    if (!q->qring_) q->qring_ = (int *)calloc(QN, sizeof(int));
+    if (q->qcount_ == QN) {
+        int old = q->qring_[q->qhead_];
+        q->free_list[q->nfree++] = old;
+        q->qring_[q->qhead_] = h;
+        q->qhead_ = (q->qhead_ + 1) % QN;
+    } else {
+        q->qring_[(q->qhead_ + q->qcount_) % QN] = h;
+        q->qcount_++;
+    }
     q->live--;
     return v;
 }
@@ -364,6 +385,8 @@
     } else {
         ret = JS_ThrowInternalError(ctx, "host function returned an unknown handle");
     }
+    HC_CHECK(q, this_h, "dispatch end (this)");
+    HC_CHECK(q, args_h, "dispatch end (args)");
     JS_FreeValue(ctx, take_(q, this_h));
     JS_FreeValue(ctx, take_(q, args_h));
     return ret;
@@ -440,6 +463,7 @@
 
 void qjs_release(void *qp, int h) {
     AeQjs *q = (AeQjs *)qp;
+    HC_CHECK(q, h, "release");
     if (valid_(q, h)) JS_FreeValue(q->ctx, take_(q, h));
 }
 
```
