/* The C side of sae, kept to what has to be C: the stdlib ROM table (a
 * generated C initialiser), the JSValue macro constants, the engine log
 * sink, and main(). Everything else is Aether, in src/sae_host.ae. */

#include <stdio.h>
#include <stdint.h>
#include <string.h>

#include "cutils.h"
#include "mquickjs.h"

#define SAE_JSFN(name) JSValue name(JSContext *ctx, JSValue *this_val, int argc, JSValue *argv)

/* Host functions named by the ROM table. The core library's (mode 2 of
 * mquickjs-ae's genengine), then the page API from gen/sae_spec.ae. All are
 * defined in src/sae_host.ae. */
SAE_JSFN(js_print);
SAE_JSFN(js_date_constructor);
SAE_JSFN(js_date_now);
SAE_JSFN(js_performance_now);

SAE_JSFN(sae_ui_vstack);
SAE_JSFN(sae_ui_hstack);
SAE_JSFN(sae_ui_text);
SAE_JSFN(sae_ui_btn);
SAE_JSFN(sae_ui_divider);
SAE_JSFN(sae_ui_button);
SAE_JSFN(sae_ui_scroll);
SAE_JSFN(sae_ui_spacer);
SAE_JSFN(sae_ui_textfield);
SAE_JSFN(sae_ui_get_text);
SAE_JSFN(sae_ui_set_text);
SAE_JSFN(sae_ui_clear);
SAE_JSFN(sae_ui_into);
SAE_JSFN(sae_ui_toggle);
SAE_JSFN(sae_ui_slider);
SAE_JSFN(sae_ui_picker);
SAE_JSFN(sae_ui_picker_add);
SAE_JSFN(sae_ui_progressbar);
SAE_JSFN(sae_ui_set_progress);
SAE_JSFN(sae_ui_set_toggle);
SAE_JSFN(sae_ui_get_toggle);
SAE_JSFN(sae_ui_set_slider);
SAE_JSFN(sae_ui_get_slider);
SAE_JSFN(sae_ui_styles);
SAE_JSFN(sae_ui_add_class);
SAE_JSFN(sae_ui_style_id);
SAE_JSFN(sae_ui_timer);
SAE_JSFN(sae_ui_set_visible);
SAE_JSFN(sae_ui_timer_cancel);
SAE_JSFN(sae_storage_get);
SAE_JSFN(sae_storage_set);
SAE_JSFN(sae_storage_remove);
SAE_JSFN(sae_ui_onclick);
SAE_JSFN(sae_ui_margin);
SAE_JSFN(sae_ui_bg_color);
SAE_JSFN(sae_ui_state);
SAE_JSFN(sae_ui_set);
SAE_JSFN(sae_ui_text_bound);
SAE_JSFN(sae_vg_scene);
SAE_JSFN(sae_vg_circle);
SAE_JSFN(sae_vg_rect);
SAE_JSFN(sae_vg_rrect);
SAE_JSFN(sae_vg_line);
SAE_JSFN(sae_vg_path);
SAE_JSFN(sae_vg_text);
SAE_JSFN(sae_vg_g);
SAE_JSFN(sae_vg_fill);
SAE_JSFN(sae_vg_stroke);
SAE_JSFN(sae_vg_opacity);
SAE_JSFN(sae_vg_transform);
SAE_JSFN(sae_vg_on_click);
SAE_JSFN(sae_vg_set_fill);
SAE_JSFN(sae_vg_set_text);
SAE_JSFN(sae_vg_set_stroke);
SAE_JSFN(sae_vg_set_opacity);

SAE_JSFN(sae_bc_change_page);
SAE_JSFN(sae_bc_back);
SAE_JSFN(sae_bc_forward);
SAE_JSFN(sae_bc_reload);
SAE_JSFN(sae_bc_current_url);

#include "sae_stdlib.h"

static void sae_log_func(void *opaque, const void *buf, size_t buf_len)
{
    fwrite(buf, 1, buf_len, stdout);
}

/* A context over the caller's memory block, with sae's ROM and log sink. */
JSContext *sae_new_context(void *mem, size_t mem_size)
{
    JSContext *ctx = JS_NewContext(mem, mem_size, &js_stdlib);
    if (ctx)
        JS_SetLogFunc(ctx, sae_log_func);
    return ctx;
}

void *sae_stdout(void) { return stdout; }
JSValue sae_js_undefined(void) { return JS_UNDEFINED; }
JSValue sae_js_null(void) { return JS_NULL; }
JSValue sae_js_exception(void) { return JS_EXCEPTION; }
int sae_js_is_exception(JSValue v) { return JS_IsException(v); }
size_t sae_gcref_size(void) { return sizeof(JSGCRef); }

/* JS_ThrowTypeError is a variadic macro; Aether calls it through this. */
JSValue sae_throw_type_error(JSContext *ctx, const char *msg)
{
    return JS_ThrowTypeError(ctx, "%s", msg);
}
size_t sae_cstringbuf_size(void) { return sizeof(JSCStringBuf); }

int sae_main(const char *arg1, const char *arg2, const char *exe); /* src/sae_host.ae */

int main(int argc, char **argv)
{
    return sae_main(argc > 1 ? argv[1] : "", argc > 2 ? argv[2] : "", argv[0]);
}
