// An app:/ page of the http list test app: no network, navigation only.
ui.text("Second page");
ui.btn("Back", () => browserContext.back());
