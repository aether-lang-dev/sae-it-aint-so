"seeks outgoing-http GET http://localhost:8091/**";
// A web page may scope another origin (here the page server under its other
// name): each request there is held to the CORS-alike, so the answer reaches
// the page only with Sae-Allow-Origin on it. A scope for http: from an
// https: page would be refused before the page runs (mixed content).
const { text, btn, set_text } = ui;
interface Res { ok: boolean; status: number; error: string }
text("Far: scoped to another origin");
const far = text("far: (none)");
const none = text("far-none: (none)");
http.get("http://localhost:8091/api/cors?allow=*", (res: Res) => set_text(far, `far: ok=${res.ok} ${res.status}`));
http.get("http://localhost:8091/api/cors", (res: Res) => set_text(none, `far-none: ok=${res.ok}`));
btn("Home", () => browserContext.changePage("/"));
