"seeks database notes";
// Each escape route, refused by the engine's authorizer.
const { text, btn, set_text } = ui;
const out = text("escape: (none)");
const tryit = (label: string, sql: string) => btn(label, async () => {
  try {
    await sqlite.notes.run(sql);
    set_text(out, `escape: ${label} RAN`);
  } catch (e) {
    set_text(out, `escape: ${label}: ${(e as Error).message}`);
  }
});
tryit("ATTACH", "attach database '/tmp/sae_escape.db' as other");
tryit("DETACH", "detach database main");
tryit("load_extension", "select load_extension('/tmp/sae_escape')");
tryit("VACUUM INTO", "vacuum into '/tmp/sae_escape_copy.db'");
tryit("PRAGMA directory", "pragma temp_store_directory = '/tmp'");
tryit("PRAGMA harmless", "pragma user_version = 3");
btn("Back home", () => browserContext.changePage("/"));
