"seeks backend";
"seeks documents";
// Docstats: the person picks a file, and a backend that may open no file at
// all reads it. sae opens what was picked and hands the backend the open
// file (a descriptor on its socket), never the path. README.md says more.
const { vstack, hstack, text, btn, textfield, get_text, set_text, clear, into,
        styles, add_class } = ui;

styles({
  root: { font_family: "sans-serif" },
  "title.label": { font_size: 18, font_weight: "bold", color: 0x2B4C7E },
  "note.label": { color: 0x666666 },
});

add_class(text("Docstats"), "title");
add_class(text("A contained backend reads the file you pick, and only that file."), "note");

const picked = text("file: (none picked)");
const progress = text("progress: -");
const found = vstack(2, () => { text("Pick a file to see what is in it."); });

type Column = { name: string; numbers: number; min?: number; max?: number; mean?: number };
type Stats = { bytes: number; lines: number; words: number; sha256: string;
               csv?: { rows: number; columns: Column[] } };

const round = (n: number): string => String(Math.round(n * 100) / 100);

const show = (s: Stats): void => {
  clear(found);
  into(found, () => {
    text(`bytes: ${s.bytes}`);
    text(`lines: ${s.lines}`);
    text(`words: ${s.words}`);
    text(`sha256: ${s.sha256}`);
    if (s.csv) {
      text(`csv rows: ${s.csv.rows}`);
      s.csv.columns.forEach((c: Column) => {
        text(c.numbers > 0
          ? `column ${c.name}: ${c.numbers} numbers, ${round(c.min!)} to ${round(c.max!)}, mean ${round(c.mean!)}`
          : `column ${c.name}: no numbers`);
      });
    }
  });
};

let reports = 0;
backend.on("progress", (bytes: string) => { reports++; set_text(progress, `progress: ${bytes} bytes read`); });
backend.on_gone((why: string) => set_text(progress, `the backend has gone: ${why}`));

btn("Pick a file...", async () => {
  const d = await documents.pick_open("A file to look into");
  if (!d) return;
  set_text(picked, `file: ${d.name}`);
  set_text(progress, "progress: starting");
  reports = 0;
  try {
    show(JSON.parse(await backend.invoke("stats", d.name, d)) as Stats);
    set_text(progress, `progress: done, after ${reports} report${reports === 1 ? "" : "s"}`);
  } catch (e) {
    set_text(progress, `failed: ${(e as Error).message}`);
  }
});

// The containment check: ask the backend to open a path by name itself.
add_class(text("Can the backend open a file by its path? Try one:"), "note");
const path = textfield("a path for the backend to try");
const tried = text("");
btn("Try it", async () => {
  try {
    set_text(tried, await backend.invoke("try_path", get_text(path)));
  } catch (e) {
    set_text(tried, `failed: ${(e as Error).message}`);
  }
});
text(backend.running() ? "backend: running" : "backend: not running");
