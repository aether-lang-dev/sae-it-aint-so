// About page.
const { text, hstack, btn } = ui;

text("About");
text("Pages are small programs, rendered as native widgets.");
hstack(4, () => {
  btn("Back", () => browserContext.back());
  btn("Home", () => browserContext.changePage("/"));
});
