"seeks outgoing-http";
// Modern TypeScript in a page, run as written: a class with a private field,
// optional chaining and ??, destructuring, an Error subclass caught across
// a container block, and an async function awaiting
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

const fetchJson = async (url: string): Promise<any> => {
  const res = await http.fetch(url);
  if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
  return res.json();
};

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
// An exception thrown in a container's block reaches the page's catch as
// itself: its class, name and message, not a copy of its text.
class Overdrawn extends Error {
  constructor(by: number) { super(`overdrawn by ${by}`); this.name = "Overdrawn"; }
}
let caught = "nothing caught";
try {
  ui.vstack(() => { throw new Overdrawn(5); });
} catch (e) {
  caught = e instanceof Overdrawn ? `caught ${e.name}: ${e.message}` : `lost its class: ${e}`;
}
text(caught);
btn("Home", () => browserContext.changePage("/"));
