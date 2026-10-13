// A cell's look, over the selection, as Excel's Home tab has it: Bold,
// Italic, Underline and Strikethrough (each on, or off when the selected
// cell has it), outline, all or no borders, and Wrap text (its rows as tall
// as their text). Ctrl+B, Ctrl+I and Ctrl+U on the grid do the first three.
import type { SheetView } from "./view.ts";

export type FontPart = "bold" | "italic" | "underline" | "strike";

// The part toggled over the selection, by what the selected cell has.
export const toggleFont = (v: SheetView, part: FontPart) =>
  v.run("format.font", { range: v.range(), [part]: v.wb.notes.get(v.here()).look?.[part] ? "0" : "1" });

export function lookBar(v: SheetView): void {
  ui.hstack(() => {
    ui.btn("Bold", () => toggleFont(v, "bold"));
    ui.btn("Italic", () => toggleFont(v, "italic"));
    ui.btn("Underline", () => toggleFont(v, "underline"));
    ui.btn("Strikethrough", () => toggleFont(v, "strike"));
    ui.btn("Outline borders", () => v.run("format.border", { range: v.range(), edge: "outline" }));
    ui.btn("All borders", () => v.run("format.border", { range: v.range(), edge: "all" }));
    ui.btn("No borders", () => v.run("format.border", { range: v.range(), edge: "none" }));
    ui.btn("Wrap text", () => v.run("format.wrap", v.wb.notes.get(v.here()).look?.wrap ? { range: v.range(), off: "1" } : { range: v.range() }));
  });
}
