"seeks outgoing-http";
// The browser's security rules, tried from a page (tests/spec_webrules.ae):
// no ambient credentials (no cookie jar, no Authorization sae adds), no
// Referer ever, an Origin only across origins, and the CORS-alike: another
// origin's answer reaches the page only when it carries
// Sae-Allow-Origin: <this page's origin> or *. The page server at
// http://localhost:8091 is the same process as http://127.0.0.1:8091, and
// another origin. Its /api/reqheaders and /api/cors echo what sae sent.
const { text, btn, set_text } = ui;

interface Res { ok: boolean; status: number; text: string; error: string; headers: Record<string, string> }

const OTHER = "http://localhost:8091";

// "name=yes name=no ..." for the headers in an echoed request.
const flags = (body: string, names: string[]) =>
  names.map((n) => `${n}=${new RegExp(`^${n}: `, "m").test(body) ? "yes" : "no"}`).join(" ");
const originSent = (body: string) => { const m = /^origin: (.*)$/m.exec(body); return m ? m[1] : "none"; };

text("The browser's security rules");

const same = text("same: (none)");
btn("Same origin", () =>
  http.request({ url: "/api/reqheaders", headers: { "X-Test": "x" } }, (res: Res) =>
    set_text(same, `same: ${res.status} ${flags(res.text, ["referer", "origin", "cookie", "authorization", "x-test"])}`)));

// A Set-Cookie is not kept: there is no cookie jar.
const cookie = text("cookie: (none)");
btn("Set cookie", async () => {
  const a: Res = await http.fetch("/api/setcookie");
  const b: Res = await http.fetch("/api/reqheaders");
  set_text(cookie, `cookie: ${a.status} ${a.headers["set-cookie"] ? "offered" : "not offered"}, then ${flags(b.text, ["cookie"])}`);
});

// Across origins sae sends its own Origin and drops the page's Origin,
// Referer, Cookie and Authorization.
const star = text("star: (none)");
btn("Cross, allowed *", () =>
  http.request({
    url: `${OTHER}/api/cors?allow=*`,
    headers: { Authorization: "token secret", Cookie: "a=b", Referer: "http://127.0.0.1:8091/webrules", Origin: "http://evil.example", "X-Test": "x" },
  }, (res: Res) =>
    set_text(star, `star: ok=${res.ok} ${res.status} origin=${originSent(res.text)} ${flags(res.text, ["referer", "cookie", "authorization", "x-test"])} secret=${res.headers["x-secret"] ? "seen" : "hidden"}`)));

const exact = text("exact: (none)");
btn("Cross, allowed exactly", () =>
  http.get(`${OTHER}/api/cors?allow=http://127.0.0.1:8091`, (res: Res) => set_text(exact, `exact: ok=${res.ok} ${res.status}`)));

const refusedLine = (label: string, res: Res) =>
  `${label}: ok=${res.ok} status=${res.status} text=${JSON.stringify(res.text)} headers=${Object.keys(res.headers).length} ${res.error}`;

const wrong = text("wrong: (none)");
btn("Cross, allowed another", () =>
  http.get(`${OTHER}/api/cors?allow=http://other.example`, (res: Res) => set_text(wrong, refusedLine("wrong", res))));

const none = text("none: (none)");
btn("Cross, no consent", () =>
  http.get(`${OTHER}/api/cors?x=none`, (res: Res) => set_text(none, refusedLine("none", res))));

// A redirect that leaves the origin is held to the same consent, on the
// response that ends the chain.
const hop = text("hop: (none)");
btn("Redirect to consent", () =>
  http.get(`/api/redirect?to=${encodeURIComponent(`${OTHER}/api/cors?allow=*`)}`, (res: Res) =>
    set_text(hop, `hop: ok=${res.ok} ${res.status} origin=${originSent(res.text)}`)));
const hopNone = text("hop-none: (none)");
btn("Redirect without consent", () =>
  http.get(`/api/redirect?to=${encodeURIComponent(`${OTHER}/api/cors?x=hop`)}`, (res: Res) => set_text(hopNone, refusedLine("hop-none", res))));

btn("Home", () => browserContext.changePage("/"));
