// Sae Tasks: an app, not a site. Run it with `sae --app apps/tasks`, or package
// it with tools/saepack.sh. There is no address bar or Back button: the app's
// own pages are its whole world, reached with browserContext.changePage.
const { vstack, hstack, text, btn, textfield, get_text, set_text, clear, into,
        styles, add_class } = ui;

styles({
  root: { font_family: "sans-serif" },
  "title.label": { font_size: 18, font_weight: "bold", color: 0x2B4C7E },
  button: { color: 0x2B4C7E },
});

let tasks: string[] = ["Try sae's app mode", "Package it with saepack"];

add_class(text("Tasks"), "title");
const field = textfield("New task", (s: string) => {});
const count = text("");
const list = vstack(2, () => {});

const show = (): void => {
  clear(list);
  into(list, () => {
    tasks.forEach((t: string, i: number) => {
      hstack(4, () => {
        btn("Done", () => { tasks.splice(i, 1); show(); });
        text(t);
      });
    });
  });
  set_text(count, tasks.length === 1 ? "1 task" : `${tasks.length} tasks`);
};

hstack(4, () => {
  btn("Add", () => {
    const t = get_text(field);
    if (t !== "") { tasks.push(t); set_text(field, ""); show(); }
  });
  btn("About", () => browserContext.changePage("/about"));
});
show();
