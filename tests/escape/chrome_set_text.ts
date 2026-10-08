// Attempt: write to every widget handle below the page's own (the address
// bar, the status line, the chrome's buttons). Expected: each throws.
const out = ui.text("chrome_set_text: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
let written = 0;
let tried = 0;
for (let h = 1; h < out; h++) {
  tried++;
  try { ui.set_text(h, "http://evil.example/ (pwned)"); written++; } catch (e) { /* refused */ }
  try { ui.get_text(h); written++; } catch (e) { /* refused */ }
  try { ui.clear(h); written++; } catch (e) { /* refused */ }
}
report(written === 0 ? `chrome_set_text: refused: ${tried} handles below the page's own, none reachable` : `chrome_set_text: ESCAPED ${written} of ${tried}`);
