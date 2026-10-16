// ui.reorderable(stack, (from, to) => ...): a stack's children dragged
// among themselves. Two rows: three buttons in a plain hstack, rebuilt from
// an array on every move, and tabs built with each() in an hstack, whose
// list moves (the container each returns is the stack). Both show the
// callback's (from, to) and their order in a text a spec reads.
const { text, btn, hstack, vstack, reorderable, set_text, clear, into } = ui;

// The array with its item at `from` moved to sit at `to`.
const move = (xs: string[], from: number, to: number): string[] => {
  const out = xs.slice();
  const it = out.splice(from, 1)[0];
  out.splice(to, 0, it);
  return out;
};

text("Reorder");

let order = ["A", "B", "C"];
const moved = text("plain moved: none");
const shown = text("plain order: A > B > C");
const clicked = text("clicked: none");
const fill = () => order.forEach((n) => btn(n, () => set_text(clicked, `clicked: ${n}`)));
const row = hstack(4, fill);
reorderable(row, (from: number, to: number) => {
  set_text(moved, `plain moved: ${from} > ${to}`);
  order = move(order, from, to);
  set_text(shown, `plain order: ${order.join(" > ")}`);
  clear(row);
  into(row, fill);
});

const sheets = state(["Sheet1", "Sheet2", "Sheet3", "Sheet4"]);
const emoved = text("each moved: none");
bind`each order: ${computed(() => sheets.value.join(" > "), sheets)}`;
hstack(4, () => {
  text("Tabs:");
  const tabs = each(sheets, (n: string) => n, (n: string) => btn(n, () => set_text(clicked, `clicked: ${n}`)));
  reorderable(tabs, (from: number, to: number) => {
    set_text(emoved, `each moved: ${from} > ${to}`);
    sheets.update((s) => move(s, from, to));
  });
});

// Not a stack: refused.
let refused = "no";
try { reorderable(moved, () => {}); } catch (e) { refused = e instanceof TypeError ? "TypeError" : "other"; }
text(`refused: ${refused}`);
