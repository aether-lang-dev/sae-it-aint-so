// A test app for spec_app_net: app.json allows http://127.0.0.1:8091/api/
// (the spec's page server) and nothing else.
const { text, btn, set_text } = ui;
const allowed = text("allowed: (none)");
const other = text("other: (none)");
btn("Allowed", () =>
  http.get("http://127.0.0.1:8091/api/echo?msg=app", (s: number, b: string, e: string) =>
    set_text(allowed, `allowed: ${s} ${b}${e}`)));
btn("Not listed", () =>
  http.get("http://127.0.0.1:8091/old-home", (s: number, b: string, e: string) =>
    set_text(other, `other: ${s} ${e}`)));
