"seeks outgoing-http";
// Attempt: forge the CORS-alike from the page side: send Sae-Allow-Origin
// and a false Origin as request headers to an origin that has not
// consented. Expected: consent is read from the response only; refused.
const out = ui.text("forge_allow_origin: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
http.request({
  url: "http://localhost:8091/api/echo?msg=forged",
  headers: { "Sae-Allow-Origin": "*", "Access-Control-Allow-Origin": "*", Origin: "http://localhost:8091", Referer: "http://localhost:8091/" },
}, (res: any) => report(res.ok ? `forge_allow_origin: ESCAPED ${res.status} ${res.text}` : `forge_allow_origin: refused: ${res.error}`));
