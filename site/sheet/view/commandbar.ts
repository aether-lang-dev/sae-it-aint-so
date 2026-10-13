// The command bar: the seam under the page, in reach. A command line
// ("data.sortDescending range=F4:G7 by=G") runs as the panels' buttons run
// theirs; a RexxJS script (a textarea: a clause a line, or ';' between
// them) drives the same commands through ADDRESS SHEET, SETCELL and GETCELL.
// What came back, and the script's SAY lines, show below. Specs drive the
// sheet through it as a person would.
import type { SheetView } from "./view.ts";

export function commandBar(v: SheetView): void {
  const line = state(""), script = state(""), said = state("");
  ui.hstack(() => {
    ui.on_submit(bind(ui.textfield("command", () => {}), line), async () => {
      const o = await v.runLine(line.value);
      said.set(o.output === undefined ? o.message : `${o.message} → ${JSON.stringify(o.output)}`);
    });
    bind(ui.textarea("RexxJS script"), script);
    ui.btn("Run script", async () => {
      const lines: string[] = [];
      const o = await v.cmds.script(script.value, (l) => {
        lines.push(l);
        print(`sheet: say ${l}`);
      });
      v.refresh();
      said.set([...lines, o.ok ? "" : `script failed: ${o.message}`].filter((l) => l).join(" | "));
    });
    ui.btn("Commands", () => said.set(v.cmds.catalogue().map((c) => c.id).join(", ")));
  });
  bind(ui.text_wrapped("", 720), said);
}
