// Inputs: a textfield whose handler gets the text, and synchronous reads
// (Tsyne pages had to `await nameEntry.getText()`; in-process, no await).
const { text, textfield, btn, get_text, set_text, scroll } = ui;

const echo = text("echo: ");
const field = textfield("your name", (s: string) => set_text(echo, `echo: ${s}`));
const shown = text("read: ");
btn("Read", () => set_text(shown, `read: ${get_text(field)}`));
btn("Home", () => browserContext.changePage("/"));
scroll(() => {
  for (let i = 0; i < 30; i++) text(`row ${i}`);
});
