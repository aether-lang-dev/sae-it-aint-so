// The site's own not-found page, served with status 404.
ui.text("404: no such page");
ui.btn("Home", function () { browserContext.changePage("/"); });
