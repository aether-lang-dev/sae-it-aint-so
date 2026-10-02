// State lives in the page's JS context until the page is left.
var n = 0;
ui.text("Counter page");
ui.btn("Increment", function () { n = n + 1; print("count " + n); });
ui.btn("Home", function () { browserContext.changePage("/"); });
