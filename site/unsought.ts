// Names fs without a "seeks local-filesystem" line: refused when the page is
// read, naming the line, before any of it runs.
ui.text("You should not see this");
fs.read_text("/etc/hosts");
