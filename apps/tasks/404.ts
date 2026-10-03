const { text, btn } = ui;
text("Not in this app");
text(browserContext.currentUrl);
btn("Tasks", () => browserContext.changePage("/"));
