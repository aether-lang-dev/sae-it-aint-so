"seeks outgoing-http";
// HTTP from a page: http.get / http.post. The requests run on Aether actors,
// off the UI thread; each callback gets a response object back on it:
//   res.ok, res.status, res.text, res.error, res.json()
const { text, btn, set_text } = ui;

interface Res { ok: boolean; status: number; text: string; error: string; json(): any }

text("HTTP from a page");
const got = text("get: (none)");
const posted = text("post: (none)");
const parsed = text("json: (none)");
const slow = text("slow: (none)");
const refused = text("refused: (none)");
const cancelled = text("cancel: (none)");
let clicks = 0;
const counter = text("clicks: 0");

btn("GET echo", () =>
  http.get("/api/echo?msg=hello", (res: Res) =>
    set_text(got, res.ok ? `get: ${res.status} ${res.text}` : `get failed: ${res.error}`)));
btn("POST echo", () =>
  http.post("/api/echo", "a body", "text/plain", (res: Res) =>
    set_text(posted, `post: ${res.status} ${res.text}`)));
// The same, awaited: http.fetch(options) is a promise of the same response.
const fetched = text("fetch: (none)");
btn("Fetch POST", async () => {
  const res = await http.fetch({ method: "POST", url: "/api/echo", body: "awaited body", contentType: "text/plain" });
  const other = await http.fetch("http://localhost:8091/api/echo?msg=fetch");   // another origin, no consent
  set_text(fetched, `fetch: ${res.status} ${res.text} | other origin ok=${other.ok}`);
});
// Redirects are followed by sae, each hop checked as the first URL was: a
// same-origin URL that redirects to another origin is answered only with
// that origin's consent (Sae-Allow-Origin), which /api/json does not give.
const away = text("away: (none)");
btn("Redirect away", () =>
  http.get("/api/redirect?to=http://localhost:8091/api/json", (res: Res) =>
    set_text(away, res.ok ? `away: followed to ${res.status}` : `away: ${res.error}`)));
btn("GET json", () =>
  http.get("/api/json", (res: Res) => {
    const data = res.json();
    set_text(parsed, `json: n=${data.n}, ${data.items.length} items, last ${data.items[2]}`);
  }));
btn("Slow GET", () => {
  set_text(slow, "slow: waiting");
  http.get("/api/slow?ms=1500", (res: Res) => set_text(slow, `slow: ${res.status} ${res.text}`));
});
// Proves the UI thread is free while a request is out.
btn("Click me", () => { clicks++; set_text(counter, `clicks: ${clicks}`); });
// http://localhost:8091 is the same page server as http://127.0.0.1:8091 and
// another origin; without Sae-Allow-Origin on its answer the page gets nothing.
btn("Other origin", () =>
  http.get("http://localhost:8091/api/echo?msg=other", (res: Res) =>
    set_text(refused, `refused: ok=${res.ok} status=${res.status} ${res.error}`)));
btn("Slow, then cancel", () => {
  const req = http.get("/api/slow?ms=500", (res: Res) => print("a cancelled request's callback ran"));
  req.cancel();
  set_text(cancelled, `cancel: request ${req.id} cancelled`);
});
// The reply arrives after this page has gone: it must be dropped, not run.
btn("Slow, then leave", () => {
  http.get("/api/slow?ms=700", (res: Res) => print("this callback must not run"));
  browserContext.changePage("/");
});
btn("Home", () => browserContext.changePage("/"));
