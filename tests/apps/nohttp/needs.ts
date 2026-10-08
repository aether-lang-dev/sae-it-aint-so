"seeks outgoing-http";
// Requires the network this app does not have: refused before any of it runs.
ui.text("You should not see this");
http.get("http://127.0.0.1:8091/api/echo?msg=x", (res: { ok: boolean }) => {});
