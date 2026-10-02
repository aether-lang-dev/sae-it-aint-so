// About page.
ui.text("About");
ui.text("Pages are small programs, rendered as native widgets.");
ui.hstack(4, function () {
  ui.btn("Back", function () { browserContext.back(); });
  ui.btn("Home", function () { browserContext.changePage("/"); });
});
