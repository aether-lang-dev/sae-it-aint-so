// The selected cell's editor (editors.ts), as the Tauri spreadsheet's
// SETCELLEDITOR gives one: a checkbox's Toggle, a dropdown's options, a
// date's Today, each a button that sets the cell; nothing for a cell with
// no editor.
import type { CellEditor } from "../editors.ts";
import type { SheetView } from "./view.ts";

const choicesOf = (e: CellEditor | null): string[] =>
  !e ? [] : e.kind === "checkbox" ? ["Toggle"] : e.kind === "date" ? ["Today"] : [...e.options!];

export function editorBar(v: SheetView): void {
  const choose = (choice: string) => {
    const cell = v.here(), kind = v.editor.value?.kind;
    if (kind === "checkbox") return v.run("cell.toggle", { cell });
    return v.run("cell.set", { cell, input: kind === "date" ? new Date().toISOString().slice(0, 10) : choice });
  };
  ui.hstack(() => {
    bind(ui.text(""), computed(() => (v.editor.value ? `${v.here()} is a ${v.editor.value.kind}:` : ""), v.editor, v.address));
    each(computed(() => choicesOf(v.editor.value), v.editor), (c: string) => c, (c: string) => ui.btn(c, () => choose(c)));
  });
}
