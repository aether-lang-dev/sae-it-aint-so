"seeks outgoing-http";
// A test app for spec_app_httplist. app.json capabilities.http lists
// http://127.0.0.1:8091/api/ (the spec's page server), the same path under
// any one label of localhost on that port, and http://localhost (port 80,
// any path: not the page server on 8091).
const { text, btn, set_text } = ui;
interface Res { ok: boolean; status: number; text: string; error: string }
const out = text("result: (none)");
const show = (label: string) => (res: Res) =>
  set_text(out, `${label}: ${res.ok ? `${res.status} ${res.text}` : `ok=false ${res.error}`}`);
const go = (label: string, url: string) => () => http.get(url, show(label));
btn("Listed", go("listed", "http://127.0.0.1:8091/api/echo?msg=app"));
btn("Await listed", async () => {
  const res: Res = await http.fetch("http://127.0.0.1:8091/api/echo?msg=awaited");
  show("await listed")(res);
});
btn("Outside the path", go("outside the path", "http://127.0.0.1:8091/old-home"));
btn("Dot segments", go("dot segments", "http://127.0.0.1:8091/api/../old-home"));
btn("Encoded dots", go("encoded dots", "http://127.0.0.1:8091/api/%2e%2e/old-home"));
btn("Other port", go("other port", "http://127.0.0.1:8092/api/echo?msg=x"));
btn("Await other port", async () => {
  const res: Res = await http.fetch("http://localhost:8091/api/json");
  show("await other port")(res);
});
btn("Wildcard", go("wildcard", "http://api.localhost:8091/api/echo?msg=wild"));
btn("Two labels", go("two labels", "http://a.b.localhost:8091/api/echo?msg=x"));
btn("Redirect within", go("redirect within", "http://127.0.0.1:8091/api/redirect?to=http://127.0.0.1:8091/api/json"));
btn("Redirect out of the path", go("redirect path", "http://127.0.0.1:8091/api/redirect?to=/old-home"));
btn("Redirect out", go("redirect out", "http://127.0.0.1:8091/api/redirect?to=http://localhost:8091/api/json"));
btn("Next page", () => browserContext.changePage("/second"));
