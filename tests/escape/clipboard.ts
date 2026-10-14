"seeks clipboard";
// Attempt: use the clipboard while the person is not clicking, typing or
// pasting (from a timer): plant text on it, and read what they copied.
// Expected: both refused (services/clipboard; docs/page-services.md 8).
const out = ui.text("clipboard: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
setTimeout(async () => {
  const got: string[] = [];
  for (const attempt of [() => clipboard.write_text("planted"), () => clipboard.read_text()]) {
    try {
      await attempt();
      got.push("done");
    } catch (e) {
      got.push("refused");
    }
  }
  report(got.every((g) => g === "refused") ? "clipboard: refused: a write and a read outside a gesture" : `clipboard: ESCAPED ${got.join(", ")}`);
}, 0);
