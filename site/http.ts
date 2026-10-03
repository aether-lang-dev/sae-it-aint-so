// HTTP from a page: http.get / http.post. The requests run on Aether actors,
// off the UI thread; the callbacks run back on it.
const { text, btn, set_text } = ui;

text("HTTP from a page");
const got = text("get: (none)");
const posted = text("post: (none)");
const slow = text("slow: (none)");
const refused = text("refused: (none)");
let clicks = 0;
const counter = text("clicks: 0");

btn("GET echo", () =>
  http.get("/api/echo?msg=hello", (status: number, body: string, err: string) =>
    set_text(got, `get: ${status} ${body}${err}`)));
btn("POST echo", () =>
  http.post("/api/echo", "a body", "text/plain", (status: number, body: string, err: string) =>
    set_text(posted, `post: ${status} ${body}${err}`)));
btn("Slow GET", () => {
  set_text(slow, "slow: waiting");
  http.get("/api/slow?ms=1500", (status: number, body: string, err: string) =>
    set_text(slow, `slow: ${status} ${body}${err}`));
});
// Proves the UI thread is free while a request is out.
btn("Click me", () => { clicks++; set_text(counter, `clicks: ${clicks}`); });
btn("Other origin", () =>
  http.get("https://example.com/", (status: number, body: string, err: string) =>
    set_text(refused, `refused: ${status} ${err}`)));
// The reply arrives after this page has gone: it must be dropped, not run.
btn("Slow, then leave", () => {
  http.get("/api/slow?ms=700", (status: number, body: string, err: string) =>
    print("this callback must not run"));
  browserContext.changePage("/");
});
btn("Home", () => browserContext.changePage("/"));
