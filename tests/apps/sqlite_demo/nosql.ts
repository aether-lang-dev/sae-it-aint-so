// A page that seeks no database has no sqlite object, by any route.
const { text, btn } = ui;
text(`nosql: ${typeof globalThis["sql" + "ite"]}`);
btn("Back home", () => browserContext.changePage("/"));
