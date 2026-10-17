// Inputs: a textfield whose handler gets the text, and synchronous reads
// (Tsyne pages had to `await nameEntry.getText()`; in-process, no await).
const { text, textfield, securefield, btn, get_text, set_text, scroll } = ui;

const echo = text("echo: ");
// A row: a narrow label field, then one that takes the rest of the width.
ui.hstack(() => {
  ui.set_width(textfield("code", () => {}), 60);
  ui.fill_width(textfield("wide", () => {}));
  btn("End", () => {});
});
// A row of two small drawn swatches, each a vg scene held at 30 wide (a
// scene's canvas otherwise takes its row's spare width).
ui.hstack(() => {
  ui.a11y_label(ui.set_width(vg.scene("0 0 10 10", 30, 30, () => vg.rect(0, 0, 10, 10, () => vg.fill("#2060c0"))), 30), "swatch one");
  ui.a11y_label(ui.set_width(vg.scene("0 0 10 10", 30, 30, () => vg.rect(0, 0, 10, 10, () => vg.fill("#c06020"))), 30), "swatch two");
});
const field = textfield("your name", (s: string) => set_text(echo, `echo: ${s}`));
const shown = text("read: ");
btn("Read", () => set_text(shown, `read: ${get_text(field)}`));
// A password: its text never shown, its length said as it is typed.
const secret = text("secret: none");
const pw = securefield("password", (s: string) => set_text(secret, `secret: ${s.length} characters`));
btn("Check", () => set_text(secret, `secret: ${get_text(pw) === "open sesame" ? "right" : "wrong"}`));
// The system's light or dark (ui.dark_mode), said again when it flips.
const look = text(`appearance: ${ui.dark_mode() ? "dark" : "light"}`);
ui.on_appearance((dark: boolean) => set_text(look, `appearance: ${dark ? "dark" : "light"}`));
btn("Home", () => browserContext.changePage("/"));
scroll(() => {
  for (let i = 0; i < 30; i++) text(`row ${i}`);
});
