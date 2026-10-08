// spec_storage_scope: one of two apps (samename_a, samename_b) with the same
// app.json name. Each must have its own storage.
const who = storage.get("who");
ui.text(`who: ${who === null ? "(none)" : who}`);
const done = ui.text("");
ui.btn("Claim", () => { storage.set("who", "b"); ui.set_text(done, "claimed b"); });
