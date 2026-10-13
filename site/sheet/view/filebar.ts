// Files: the workbook saved to and opened from the page's storage by name
// (every sheet, its notes and names, in the Tauri app's format), the saved
// files listed; a new workbook; CSV out (what the selection, or everything
// used, shows) and in (at the selected cell); the Excel example, the Tauri
// app's three sample sheets (RexxJS formulas), an empty sheet, and the way
// home.
import type { SheetView } from "./view.ts";

export function fileBar(v: SheetView): void {
  const name = state(""), csv = state(""), saved = state(""), shown = state("");
  const listed = async () => {
    const o = await v.cmds.execute("file.list");
    saved.set(o.message);
  };
  ui.hstack(() => {
    bind(ui.textfield("file name", () => {}), name);
    ui.btn("Save", async () => { await v.run("file.save", name.value.trim() ? { name: name.value } : {}); await listed(); });
    ui.btn("Open", () => v.run("file.open", { name: name.value }));
    ui.btn("Delete file", async () => { await v.run("file.delete", { name: name.value }); await listed(); });
    ui.btn("New", () => v.run("file.new"));
    bind(ui.text(""), saved);
  });
  ui.hstack(() => {
    ui.btn("Export CSV", async () => {
      const s = v.selection(), many = s && (s[0].col !== s[1].col || s[0].row !== s[1].row);
      const o = await v.run("file.exportCsv", many ? { range: v.range() } : {});
      shown.set(String(o.output ?? ""));
    });
    bind(ui.textarea("CSV"), csv);
    ui.btn("Import CSV", () => v.run("file.importCsv", { at: v.here(), text: csv.value }));
  });
  bind(ui.text_wrapped("", 720), shown);
  ui.hstack(() => {
    ui.btn("Paste example", () => v.run("example.paste"));
    ui.btn("Budget (RexxJS)", () => v.run("file.open", { sample: "budget" }));
    ui.btn("Test sheet (RexxJS)", () => v.run("file.open", { sample: "test" }));
    ui.btn("Formatted (RexxJS)", () => v.run("file.open", { sample: "formatted" }));
    ui.btn("Clear all", () => v.run("sheet.clear"));
    ui.btn("Home", () => browserContext.changePage("/"));
  });
  listed();
}
