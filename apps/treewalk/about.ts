// Another page of treewalk: the backend's walk goes on while it shows. The
// walk's events reach whichever page is showing; this one does not listen.
const { text, btn } = ui;
text("Treewalk: another page");
text("The walk goes on while this page shows.");
btn("Back to the walk", () => browserContext.changePage("/"));
