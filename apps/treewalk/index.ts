"seeks backend";
// Treewalk: the backend walks a folder and pushes what it finds as it goes,
// events the page did not ask for, while the page stays free to do other
// things; Cancel stops it, another page can show meanwhile, and a backend
// that dies is restarted. README.md says more.
const { vstack, hstack, text, btn, textfield, get_text, set_text, clear, into,
        styles, add_class } = ui;

styles({
  root: { font_family: "sans-serif" },
  "title.label": { font_size: 18, font_weight: "bold", color: 0x2B4C7E },
  "note.label": { color: 0x666666 },
  "path.label": { font_family: "monospace" },
});

add_class(text("Treewalk"), "title");
add_class(text("A backend walks the folder; this page hears what it finds."), "note");

const folder = textfield("a folder to walk");
set_text(folder, "~");

type Status = { state: string; root: string; files: number; dirs: number; bytes: number; current: string; why: string };

const where = text("state: idle");
const heard = text("found events: 0");
const answer = text("answer: (none)");
const gone = text("backend: running");
const recent = vstack(1, () => {});

// Every file found is an event; the list shows the last SHOWN, drawn at most
// ten times a second however fast they come.
const SHOWN = 8;
let last: string[] = [];
let count = 0;
let drawing = false;
const draw = (): void => {
  drawing = false;
  set_text(heard, `found events: ${count}`);
  clear(recent);
  into(recent, () => { last.forEach((l: string) => add_class(text(l), "path")); });
};
const show = (s: Status): void => {
  set_text(where, `state: ${s.state}: ${s.files} files, ${s.dirs} folders, ${s.bytes} bytes`);
};

backend.on("found", (line: string) => {
  count++;
  last.push(line);
  if (last.length > SHOWN) last.shift();
  if (!drawing) { drawing = true; setTimeout(draw, 100); }
});
backend.on("progress", (json: string) => show(JSON.parse(json) as Status));
backend.on_gone((why: string) => set_text(gone, `backend: gone: ${why}`));

hstack(4, () => {
  btn("Walk", async () => {
    count = 0;
    last = [];
    draw();
    set_text(answer, "answer: (walking)");
    try {
      set_text(answer, `answer: ${await backend.invoke("walk", get_text(folder))}`);
    } catch (e) {
      set_text(answer, `answer: failed: ${(e as Error).message}`);
    }
    draw();
  });
  btn("Cancel", () => { backend.invoke("cancel").catch(() => {}); });
  btn("Crash it", () => { backend.invoke("crash").catch(() => {}); });
  btn("Restart", async () => {
    try {
      await backend.restart();
      set_text(gone, "backend: running (restarted)");
      show(JSON.parse(await backend.invoke("status")) as Status);
    } catch (e) {
      set_text(gone, `backend: not running: ${(e as Error).message}`);
    }
  });
  btn("Another page", () => browserContext.changePage("/about"));
});

// The walk belongs to the app, not to this page: one may be going on, or
// have ended, from before this page loaded.
if (backend.running()) {
  backend.invoke("status").then((j: string) => show(JSON.parse(j) as Status), () => {});
} else {
  set_text(gone, "backend: not running");
}
