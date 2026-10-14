"seeks clipboard";
"seeks clipboard-read";
// A test app for spec_app_clipboard: app.json's clipboard grant lets it
// write at any time (from a timer, below), and with "read" and
// clipboard-read, read at any time (a click is not a paste). See
// docs/page-services.md, section 8.
const { text, btn, set_text } = ui;
const wrote = text("wrote: (not yet)");
setTimeout(() => {
  clipboard.write_text("from the app").then(() => set_text(wrote, "wrote: from the app"), (e) => set_text(wrote, `wrote: refused: ${e.message}`));
}, 0);
const read = text("read: (not yet)");
btn("read", () => {
  clipboard.read_text().then((t) => set_text(read, `read: ${t}`), (e) => set_text(read, `read: refused: ${e.message}`));
});
