"seeks database notes";
"seeks database nope, reduced functionality without";
// An optional database the app does not declare is simply absent.
const { text, btn } = ui;
text(`optional: notes=${typeof sqlite.notes} nope=${typeof sqlite.nope}`);
btn("Back home", () => browserContext.changePage("/"));
