"seeks local-filesystem, reduced functionality without";
"seeks open-urls, reduced functionality without";
// A page that can do without what it seeks: it loads where those cannot be
// granted (a web page gets neither of these), finds the objects absent, and
// falls back. (An optional http scope on another origin is no longer
// "beyond the grant" in the browser: the CORS-alike holds each request to
// that origin's consent instead, so http would be present.)
const { text } = ui;
text("A page that can do without");
text(typeof fs === "undefined" ? "files: not available, working without" : "files: available");
text(typeof shell === "undefined" ? "open-urls: not available, working without" : "open-urls: available");
