// Dynamic import() stays refused: no module loader is installed for it.
const t = ui.text("dynamic: pending");
import("./lib/card.ts").then(
  () => ui.set_text(t, "dynamic: loaded"),
  (e: any) => ui.set_text(t, `dynamic: rejected ${e && e.name}`));
