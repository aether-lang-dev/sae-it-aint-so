"seeks outgoing-http";
// Attempt: fetch another origin that has not consented (no Sae-Allow-Origin).
// Expected: res.ok false, the CORS-alike's reason, logged once; nothing of
// the answer reaches the page.
const out = ui.text("other_origin: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
http.get("http://localhost:8091/api/echo?msg=other_origin", (res: any) =>
  report(res.ok || res.text !== "" || res.status !== 0 || Object.keys(res.headers).length > 0
    ? `other_origin: ESCAPED ${res.status} ${JSON.stringify(res.text)}`
    : `other_origin: refused: ${res.error}`));
