"seeks local-filesystem";
// A page that asks for the file system. A web page in the browser cannot
// have it, so sae refuses the page before any of it runs, and says why.
ui.text("You should not see this");
fs.read_text("/etc/hosts");
