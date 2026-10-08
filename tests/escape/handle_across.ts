// Attempt, part one: keep a widget handle and carry it to the next page
// through storage. handle_across_2 tries to use it there. Expected: the
// next page's call throws (the handle is below that page's own).
const h = ui.text("handle_across: leaving");
storage.set("esc.handle", String(h));
browserContext.changePage("/handle_across_2");
