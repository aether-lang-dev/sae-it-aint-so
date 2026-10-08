"seeks outgoing-http";
// Attempt: a same-origin URL that redirects to another origin, which has
// not consented. Expected: the hop is followed with sae's Origin, the final
// answer is withheld (res.ok false, the reason), logged once.
const out = ui.text("redirect_out: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
http.get("/api/redirect?to=http://localhost:8091/api/json?from=redirect_out", (res: any) =>
  report(res.ok || res.text !== "" ? `redirect_out: ESCAPED ${res.status} ${res.text}` : `redirect_out: refused: ${res.error}`));
