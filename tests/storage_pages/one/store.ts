// spec_storage_scope: a file: page in storage_pages/one. File pages share
// storage with their own directory and no other.
const who = storage.get("who");
ui.text(`one sees: ${who === null ? "(none)" : who}`);
const done = ui.text("");
ui.btn("Claim", () => { storage.set("who", "one"); ui.set_text(done, "claimed one"); });
