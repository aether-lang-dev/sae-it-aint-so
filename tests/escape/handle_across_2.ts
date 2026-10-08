// Attempt, part two (see handle_across.ts): use the previous page's handle.
const out = ui.text("handle_across: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const h = Number(storage.get("esc.handle"));
storage.remove("esc.handle");
try { ui.set_text(h, "pwned"); report(`handle_across: ESCAPED wrote handle ${h}`); }
catch (e: any) { report(`handle_across: refused: handle ${h}: ${e.message}`); }
