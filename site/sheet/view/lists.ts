// What the sheet says about itself: the status line, the functions its
// language has, the setup script, and the problems (each cell whose value
// is an error), with a count.
import type { Problem } from "../sheet.ts";
import type { SheetView } from "./view.ts";

export function statusLine(v: SheetView): void {
  bind(ui.text(""), v.status);
}

export function functionList(v: SheetView): void {
  bind(ui.text_wrapped("", 720), computed(() => {
    const own = v.formulas.value === "RexxJS" ? ", and RexxJS's own (UPPER, SUBSTR, WORD, LENGTH, ...)" : "";
    return `${v.formulas.value} functions: ${v.wb.sheet.language.functions().join(", ")}${own}`;
  }, v.formulas));
}

export function setupScript(v: SheetView): void {
  bind(ui.text_wrapped("", 720), v.setup);
}

export function problemList(v: SheetView): void {
  bind(ui.text(""), computed(() => {
    const n = v.problems.value.length;
    return n === 0 ? "No problems" : `${n} problem${n === 1 ? "" : "s"}`;
  }, v.problems));
  each(v.problems, "key", (p: Problem) => ui.text(`${p.key}: ${p.message}`));
}
