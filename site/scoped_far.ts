"seeks outgoing-http GET https://example.com/*";
// A web page in the browser may reach only its own origin, so a scope on
// another one is refused before any of the page runs.
ui.text("You should not see this");
http.get("https://example.com/", () => {});
