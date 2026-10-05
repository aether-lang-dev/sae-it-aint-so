"seeks outgoing-http GET http://127.0.0.1:8091/api/json";
// A scope inside app.json's http grant: the page loads, and may make the
// one request it names and no other the grant would allow.
const { text, btn, set_text } = ui;
interface Res { ok: boolean; status: number; error: string }
text("Scoped app");
const out = text("result: (none)");
const show = (label: string) => (res: Res) =>
  set_text(out, `${label}: ${res.ok ? `ok ${res.status}` : `refused (${res.error})`}`);
btn("Sought", () => http.get("http://127.0.0.1:8091/api/json", show("sought")));
btn("Granted but unsought", () => http.get("http://127.0.0.1:8091/api/echo?msg=x", show("unsought")));
btn("Beyond the grant", () => browserContext.changePage("/beyond"));
btn("Can do without", () => browserContext.changePage("/optional"));
