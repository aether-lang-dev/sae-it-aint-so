"seeks outgoing-http";
// A test app for spec_app_net: app.json allows http://127.0.0.1:8091/api/
// (the spec's page server) and nothing else.
const { text, btn, set_text } = ui;
interface Res { ok: boolean; status: number; text: string; error: string }
const allowed = text("allowed: (none)");
const other = text("other: (none)");
btn("Allowed", () =>
  http.get("http://127.0.0.1:8091/api/echo?msg=app", (res: Res) =>
    set_text(allowed, `allowed: ${res.status} ${res.text}`)));
btn("Not listed", () =>
  http.get("http://127.0.0.1:8091/old-home", (res: Res) =>
    set_text(other, `other: ok=${res.ok} ${res.error}`)));
