"seeks outgoing-http";
// Modern TypeScript in a page, run as written: a class with a private field,
// optional chaining and ??, destructuring, and an async function awaiting
// an http request (which runs on an Aether actor; the await resumes when
// its answer comes back on the UI thread).
const { text, btn, set_text } = ui;

class Tally {
  #count = 0;
  constructor(private_label: string) { this.label = private_label; }
  label: string;
  bump(): this { this.#count++; return this; }
  get summary(): string { return `${this.label}: ${this.#count}`; }
}

const fetchJson = (url: string): Promise<any> =>
  new Promise((resolve, reject) =>
    http.get(url, (res) => (res.ok ? resolve(res.json()) : reject(new Error(res.error || `HTTP ${res.status}`)))));

const tally = new Tally("clicks");
const shown = text(tally.summary);
const loaded = text("loaded: (not yet)");
btn("Bump", () => set_text(shown, tally.bump().summary));
btn("Load", async () => {
  set_text(loaded, "loaded: waiting");
  const { n, items: [first, ...others] } = await fetchJson("/api/json");
  const missing = (others as any).nope?.length ?? "none";
  set_text(loaded, `loaded: n=${n} first=${first} others=${others.join("")} missing=${missing}`);
});
btn("Home", () => browserContext.changePage("/"));
