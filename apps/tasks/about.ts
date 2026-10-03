// About: a second page of the app, and the app's links back out.
const { text, btn } = ui;

text("Sae Tasks");
text(`This page is ${browserContext.currentUrl}`);
text("An app made of sae pages, packaged to install like any other.");
btn("Back", () => browserContext.back());
// Apps reach only their own pages; this is refused, and the page stays.
btn("Open the web", () => browserContext.changePage("https://example.com/"));
btn("A page that is not there", () => browserContext.changePage("/nowhere"));
