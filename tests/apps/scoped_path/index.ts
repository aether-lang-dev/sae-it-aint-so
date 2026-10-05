"seeks outgoing-http GET /api/json";
// An app's page has no web origin, so a path-only pattern means nothing: refused at load.
ui.text("You should not see this");
