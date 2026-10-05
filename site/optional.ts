"seeks local-filesystem, reduced functionality without";
"seeks outgoing-http GET https://example.com/*, reduced functionality without";
// A page that can do without what it seeks: it loads where those cannot be
// granted (a web page gets neither of these), finds the objects absent, and
// falls back.
const { text } = ui;
text("A page that can do without");
text(typeof fs === "undefined" ? "files: not available, working without" : "files: available");
text(typeof http === "undefined" ? "network: not available, working without" : "network: available");
