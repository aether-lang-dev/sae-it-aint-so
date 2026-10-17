// Inputs: a textfield whose handler gets the text, and synchronous reads
// (Tsyne pages had to `await nameEntry.getText()`; in-process, no await).
const { text, textfield, securefield, btn, get_text, set_text, scroll } = ui;

const echo = text("echo: ");
const field = textfield("your name", (s: string) => set_text(echo, `echo: ${s}`));
const shown = text("read: ");
btn("Read", () => set_text(shown, `read: ${get_text(field)}`));
// A password: its text never shown, its length said as it is typed.
const secret = text("secret: none");
const pw = securefield("password", (s: string) => set_text(secret, `secret: ${s.length} characters`));
btn("Check", () => set_text(secret, `secret: ${get_text(pw) === "open sesame" ? "right" : "wrong"}`));
btn("Home", () => browserContext.changePage("/"));
scroll(() => {
  for (let i = 0; i < 30; i++) text(`row ${i}`);
});
