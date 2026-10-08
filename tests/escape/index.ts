// The escape corpus (sandbox-breakout-alike: Tsyne's examples/sandbox-breakout
// was an app whose only job was to try to break out and print what happened).
// One page per attempt; each must be refused and logged exactly once, and
// tests/spec_escape.ae holds every one to that. docs/roadmap.md 1.4 and 8.3.
const { text, btn } = ui;
text("The escape corpus: every page here tries to get out");
const attempts: [string, string][] = [
  ["other_origin", "fetch another origin, without its consent"],
  ["mixed_content", "http: from a page (https: where the lane has it)"],
  ["redirect_out", "a same-origin URL that redirects out of the origin"],
  ["computed_fs", "reach fs and shell by a computed name"],
  ["chrome_set_text", "set_text on the chrome's handles"],
  ["chrome_navigate", "navigate the browser to a file, as an app: page"],
  ["other_storage", "read another origin's storage by key"],
  ["cap_http", "more http requests in flight than the cap"],
  ["cap_timers", "more timers and frames pending than the cap"],
  ["cap_storage", "more storage than the origin's cap"],
  ["cpu", "loop forever"],
  ["heap", "allocate past the heap cap"],
  ["import_url", "import() a URL"],
  ["handle_across", "hold a widget handle across a navigation"],
  ["atomics_wait", "block the thread with Atomics.wait"],
  ["forge_allow_origin", "forge Sae-Allow-Origin and Origin from the page side"],
  ["second_window", "open a second window"],
];
for (const [name, what] of attempts) btn(`${name}: ${what}`, () => browserContext.changePage(`/${name}`));
