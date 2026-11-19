"seeks backend";
// Rexx console: Rexx you type runs in the app's backend, a separate process
// with RexxAE's engine compiled in, contained, reaching nothing. Its SAYs
// stream back as they happen; a script has a time limit, Cancel stops it
// from inside the engine, and Kill ends the backend itself and starts a new
// one. README.md says more.
const { vstack, hstack, text, btn, textfield, textarea, get_text, set_text,
        clear, into, styles, add_class } = ui;

styles({
  root: { font_family: "sans-serif" },
  "title.label": { font_size: 18, font_weight: "bold", color: 0x2B4C7E },
  "note.label": { color: 0x666666 },
  "out.label": { font_family: "monospace" },
});

add_class(text("Rexx console"), "title");
add_class(text("Each run is a Rexx script in a contained backend process."), "note");

const script = textarea("a Rexx script");
set_text(script, "/* Try DO FOREVER; END, then Cancel */\nDO i = 1 TO 5\n  SAY 'line' i 'at' ELAPSED() 'ms'\nEND\nEXIT 0");
const limit = textfield("time limit, ms");
set_text(limit, "3000");

const status = text("status: ready");
const said = text("lines said: 0");
const out = vstack(1, () => {});

// What the script has said: the last SHOWN lines, drawn at most every 50 ms
// however fast they come (a loop of SAYs can send thousands a second).
const SHOWN = 12;
let lines: string[] = [];
let count = 0;
let drawing = false;
const draw = (): void => {
  drawing = false;
  set_text(said, `lines said: ${count}`);
  clear(out);
  into(out, () => { lines.forEach((l: string) => add_class(text(l), "out")); });
};
backend.on("say", (line: string) => {
  count++;
  lines.push(line);
  if (lines.length > SHOWN) lines.shift();
  if (!drawing) { drawing = true; setTimeout(draw, 50); }
});
backend.on_gone((why: string) => set_text(status, `status: the backend has gone: ${why}`));

hstack(4, () => {
  btn("Run", async () => {
    lines = [];
    count = 0;
    draw();
    set_text(status, "status: running");
    const ms = parseInt(get_text(limit), 10);
    try {
      const r = await backend.invoke("run", JSON.stringify({ source: get_text(script), limitMs: isNaN(ms) ? 3000 : ms }));
      set_text(status, `status: ${r}`);
    } catch (e) {
      set_text(status, `status: ${(e as Error).message}`);
    }
    draw();
  });
  btn("Cancel", () => { backend.invoke("cancel").catch(() => {}); });
  // A stand-in for an engine stuck in native code, where Cancel cannot reach.
  btn("Wedge it", () => {
    set_text(status, "status: wedged (only Kill ends it)");
    backend.invoke("wedge").catch(() => {});
  });
  // The kill switch: the backend process killed and a new one started.
  btn("Kill", async () => {
    try {
      await backend.restart();
      set_text(status, "status: ready (a new backend)");
    } catch (e) {
      set_text(status, `status: no backend: ${(e as Error).message}`);
    }
  });
});
