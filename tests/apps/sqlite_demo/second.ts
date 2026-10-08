"seeks database notes";
// The page after a navigation: its query runs on the same actor, after
// whatever the previous page left there.
const { text, btn, set_text } = ui;
const out = text("second: (loading)");
sqlite.notes.get("select count(*) as n from notes where body in ('abandoned', 'ghost', 'phantom')")
  .then((r: { n: number }) => set_text(out, `second: stray rows=${r.n}`))
  .catch((e: Error) => set_text(out, `second: error ${e.message}`));
btn("Back home", () => browserContext.changePage("/"));
