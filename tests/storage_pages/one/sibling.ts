// spec_storage_scope: another file: page in storage_pages/one: same scope.
const who = storage.get("who");
ui.text(`sibling sees: ${who === null ? "(none)" : who}`);
