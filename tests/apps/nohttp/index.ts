"seeks outgoing-http, reduced functionality without";
// A test app for spec_app_nohttp: app.json has no capabilities.http, so no
// network at all. The page can do without http, so it loads, without it.
const { text, btn } = ui;
text(`No http app: http is ${typeof http}`);
btn("Next page", () => browserContext.changePage("/second"));
btn("Needs network", () => browserContext.changePage("/needs"));
btn("Leave", () => browserContext.changePage("http://127.0.0.1:8091/"));
