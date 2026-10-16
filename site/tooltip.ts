// ui.tooltip(h, text): a widget's tooltip. A button with one, a field with
// one, and a button whose tooltip a click takes off ("").
const { text, btn, textfield, tooltip } = ui;

text("Tooltips");
const save = tooltip(btn("Save", () => {}), "Save the workbook (Ctrl+S)");
tooltip(textfield("cell", () => {}), "The Name Box: a cell or a name");
const off = btn("Plain", () => tooltip(off, ""));
tooltip(off, "Click to take this off");
text(`returns its widget: ${save > 0 ? "yes" : "no"}`);
let why = "";
try {
  tooltip(99999, "x");
} catch (e) {
  why = String((e as Error).message);
}
text(`refused: ${why}`);
