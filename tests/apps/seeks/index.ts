"seeks outgoing-http";
"seeks local-filesystem";
// app.json grants http but not the file system, so this app is refused
// before it runs, naming what is missing.
ui.text("You should not see this");
