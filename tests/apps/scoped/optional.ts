"seeks local-filesystem, reduced functionality without";
// app.json grants no file system: the page loads without fs.
ui.text(typeof fs === "undefined" ? "files: not available, working without" : "files: available");
ui.btn("Back", () => browserContext.back());
