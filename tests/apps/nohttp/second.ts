// An app:/ page: no network, navigation only.
ui.text("Second page");
ui.btn("Back", () => browserContext.back());
