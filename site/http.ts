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
btn("Other origin", () =>
  http.get("https://example.com/", (res: Res) =>
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
