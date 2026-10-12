// Data validation for the selection: what is allowed ("Yes,No" for a list,
// "1..10", ">=0" for numbers, "<=20" for a text length), stop or only warn,
// a rule cleared, and Circle invalid for what breaks one.
import { limitsOf } from "../validation.ts";
import type { SheetView } from "./view.ts";

export function validationBar(v: SheetView): void {
  const allowed = state("");
  let warn = false;
  const rule = (kind: string, extra: Record<string, string>) =>
    v.run("validation.set", { range: v.range(), kind, mode: warn ? "warn" : "stop", ...extra });
  ui.hstack(() => {
    bind(ui.textfield("allowed", () => {}), allowed);
    ui.btn("Allow list", () => rule("list", { values: allowed.value }));
    ui.btn("Allow whole numbers", () => rule("whole", limitsOf(allowed.value)));
    ui.btn("Allow decimals", () => rule("decimal", limitsOf(allowed.value)));
    ui.btn("Allow length", () => rule("length", limitsOf(allowed.value)));
    ui.toggle("Warn only", (on: boolean) => { warn = !!on; });
    ui.btn("Clear rule", () => v.run("validation.clear", { range: v.range() }));
    ui.btn("Circle invalid", () => v.run("validation.circle"));
  });
}
