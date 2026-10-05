"seeks outgoing-http GET /api/json";
"seeks outgoing-http GET,POST /api/echo";
"seeks outgoing-http GET /api/redirect";
// Scoped seeks: this page may make exactly the requests its first lines
// name, method and path, and nothing else on its origin. A redirect is
// held to the same scopes at every hop. docs/app-capabilities.md.
const { text, btn, set_text } = ui;

interface Res { ok: boolean; status: number; text: string; error: string }

text("Scoped requests");
const out = text("scoped: (none)");
const show = (label: string) => (res: Res) =>
  set_text(out, `${label}: ${res.ok ? `ok ${res.status}` : `refused (${res.error})`}`);

btn("Sought GET", () => http.get("/api/json", show("sought GET")));
btn("Sought POST", () => http.post("/api/echo", "hi", "text/plain", show("sought POST")));
btn("Unsought path", () => http.get("/api/headers", show("unsought path")));
btn("Unsought method", () => http.request({ method: "PUT", url: "/api/echo" }, show("unsought method")));
btn("Redirect within", () => http.get("/api/redirect?to=/api/json", show("redirect within")));
btn("Redirect beyond", () => http.get("/api/redirect?to=/api/headers", show("redirect beyond")));
btn("Home", () => browserContext.changePage("/"));
