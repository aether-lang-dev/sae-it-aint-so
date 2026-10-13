// Conditional formatting over the selection, as Excel's menu has it:
// Highlight Cells (greater than, less than, equal to, text that contains,
// the value in the field), Top 10, Above average, Duplicates, a colour scale
// (Excel's red, yellow, green), an icon set (arrows), data bars, Clear rules; and the
// sheet's rules listed, the first one winning.
import type { SheetView } from "./view.ts";

export function rulesBar(v: SheetView): void {
  const value = state(""), listed = state("");
  const added = async (o: Promise<unknown>) => {
    await o;
    listed.set((await v.cmds.execute("format.rules")).message);
  };
  const highlight = (op: string) => () => added(v.run("format.highlight", { range: v.range(), op, value: value.value }));
  ui.hstack(() => {
    bind(ui.textfield("rule value", () => {}), value);
    ui.btn("Greater than", highlight("greater"));
    ui.btn("Less than", highlight("less"));
    ui.btn("Equal to", highlight("equal"));
    ui.btn("Text contains", highlight("contains"));
    ui.btn("Top 10", () => added(v.run("format.topBottom", { range: v.range() })));
    ui.btn("Above average", () => added(v.run("format.aboveAverage", { range: v.range() })));
    ui.btn("Duplicates", () => added(v.run("format.duplicates", { range: v.range() })));
    ui.btn("Color scale", () => added(v.run("format.colorScale", { range: v.range() })));
    ui.btn("Icon set", () => added(v.run("format.iconSet", { range: v.range() })));
    ui.btn("Data bars", () => added(v.run("format.dataBar", { range: v.range() })));
    ui.btn("Clear rules", () => added(v.run("format.clearRules", { range: v.range() })));
  });
  bind(ui.text_wrapped("", 720), listed);
}
