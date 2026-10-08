"seeks outgoing-http";
// Attempt: fetch http: from this page. From an https: page that is mixed
// content and refused before any socket ("mixed content: a page from https:
// may not fetch http:"), logged once. The spec harness serves pages over
// http:, where the same request is an ordinary cross-origin one, allowed
// here by Sae-Allow-Origin: *; the https: case is held by
// tests/spec_origin_rules.ae until a lane serves this corpus over TLS.
const out = ui.text("mixed_content: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const secure = browserContext.currentUrl.startsWith("https:");
http.get("http://localhost:8091/api/cors?allow=*", (res: any) => {
  if (secure) report(res.ok ? `mixed_content: ESCAPED ${res.status}` : `mixed_content: refused: ${res.error}`);
  else report(res.ok ? `mixed_content: not mixed: this page is http:, and the other origin consented (${res.status})` : `mixed_content: refused: ${res.error}`);
});
