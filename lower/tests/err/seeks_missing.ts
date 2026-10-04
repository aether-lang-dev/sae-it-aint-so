"seeks outgoing-http";
ui.text("hello");
fs.read_text("/etc/hosts");
// error: 3:1: fs needs "seeks local-filesystem" at the top of the page
