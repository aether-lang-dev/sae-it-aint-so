// Home page.
ui.text("Welcome to Sae it ain't so");
ui.text("You are at " + browserContext.currentUrl);
ui.divider();
ui.btn("About", function () { browserContext.changePage("/about"); });
ui.btn("Counter", function () { browserContext.changePage("/counter"); });
ui.btn("A page that is not there", function () { browserContext.changePage("/nowhere"); });
ui.btn("Old home (302 to /)", function () { browserContext.changePage("/old-home"); });
ui.btn("A page that throws", function () { browserContext.changePage("/broken"); });
