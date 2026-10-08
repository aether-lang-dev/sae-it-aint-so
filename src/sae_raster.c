/* wave1/raster: the bytes of a page's Uint8Array, for vg.raster / vg.image /
 * ui.image (src/sae_host.ae, "the page API: rasters").
 *
 * WORKAROUND, labelled: contrib.quickjs has no way to read a typed array's
 * bytes (asks/quickjs-typed-array-bytes.md asks for one). Until it does,
 * this file reaches into the engine itself: contrib.quickjs keeps every
 * handle's JSValue in a table whose first three fields are (rt, ctx, vals),
 * mirrored here as SaeQjsHead; QuickJS's own API then gives the array's
 * buffer. The mirror is checked, not trusted: sae_qjs_u8_self_check runs a
 * known array through it at first use, and the page API refuses rasters if
 * the answer is wrong, rather than reading memory it has misread. Replace
 * all of this with quickjs.arg_bytes when the ask lands. */
#include "quickjs.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct { JSRuntime *rt; JSContext *ctx; JSValue *vals; } SaeQjsHead;

extern int qjs_eval(void *qp, const char *code, const char *filename, int flags);
extern void qjs_release(void *qp, int h);

/* The bytes of the Uint8Array / Uint8ClampedArray at handle h (a view's own
 * window of its buffer), and their count in *out_len; NULL when h is not
 * one. The pointer is the engine's: copy it before anything runs JS. */
const unsigned char *sae_qjs_u8_bytes(void *qp, int h, int *out_len) {
    SaeQjsHead *q = (SaeQjsHead *)qp;
    if (out_len) *out_len = 0;
    if (!q || !q->vals || h < 1) return NULL;
    JSValue v = q->vals[h];
    if (!JS_IsObject(v)) return NULL;
    int t = JS_GetTypedArrayType(v);
    if (t != JS_TYPED_ARRAY_UINT8 && t != JS_TYPED_ARRAY_UINT8C) return NULL;
    size_t off = 0, len = 0, bpe = 0;
    JSValue ab = JS_GetTypedArrayBuffer(q->ctx, v, &off, &len, &bpe);
    if (JS_IsException(ab)) return NULL;
    size_t size = 0;
    uint8_t *base = JS_GetArrayBuffer(q->ctx, &size, ab);
    JS_FreeValue(q->ctx, ab);
    if (!base || off > size || len > size - off) return NULL;
    if (len > (size_t)0x7fffffff) return NULL;
    if (out_len) *out_len = (int)len;
    return base + off;
}

/* 1 when a Uint8Array made in runtime qp reads back byte for byte through
 * sae_qjs_u8_bytes: the layout mirror above still matches the engine. */
int sae_qjs_u8_self_check(void *qp) {
    int h = qjs_eval(qp, "new Uint8Array([9, 1, 2, 3]).subarray(1)", "sae-raster-check", 0);
    if (h < 0) return 0;
    int n = 0;
    const unsigned char *b = sae_qjs_u8_bytes(qp, h, &n);
    int ok = b && n == 3 && b[0] == 1 && b[1] == 2 && b[2] == 3;
    qjs_release(qp, h);
    return ok;
}
