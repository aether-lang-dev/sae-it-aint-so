// Static imports: a shared component from the site's own origin, and the
// sae: library. The imports run before this page does.
import describe, { card, made, version } from "./lib/card.ts";
import * as cards from "./lib/card.ts";
import { linear } from "sae:scales";
const { text, btn } = ui;
text(`imports page: ${version}`);
card({ title: "First", lines: ["one", "two"] });
card({ title: "Second", lines: ["three"] });
text(`made: ${made} at import, ${cards.made} now; ${describe()}`);
text(`scale: ${linear([0, 10], [0, 100])(2.5)}`);
btn("Noise page", () => browserContext.changePage("/import_noise"));
btn("Cross-origin", () => browserContext.changePage("/import_cross"));
btn("Data URL", () => browserContext.changePage("/import_data"));
btn("Cycle", () => browserContext.changePage("/import_cycle"));
btn("Bad hash", () => browserContext.changePage("/import_hash"));
btn("Good hash", () => browserContext.changePage("/import_hash_ok"));
btn("Dynamic", () => browserContext.changePage("/import_dynamic"));
btn("Missing", () => browserContext.changePage("/import_missing"));
btn("Top-level await", () => browserContext.changePage("/import_await"));
