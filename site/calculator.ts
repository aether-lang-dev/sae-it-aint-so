// The calculator from aether-ui's examples/calculator, as a page: the same
// shape as the Aether DSL, with trailing blocks as last arguments.
const { vstack, hstack, btn, button, bg_color, onclick, divider,
        text_bound, ui_state, ui_set, margin } = ui;

type Op = (a: number, b: number) => number;

let num = 0, prev = 0;
let op: Op = (a, b) => a;
const display = ui_state(0);

const digit = (d: number) => { num = num * 10 + d; ui_set(display, num); };
const apply_op = (f: Op) => { prev = num; num = 0; op = f; ui_set(display, 0); };
const equals = () => { num = op(prev, num); prev = 0; ui_set(display, num); };
const clear = () => { num = 0; prev = 0; ui_set(display, 0); };

const key_op = (label: string, f: Op) => {
  button(label, () => {
    bg_color(0.95, 0.85, 0.5, 1.0);
    onclick(() => apply_op(f));
  });
};

vstack(4, () => {
  margin(12, 12, 12, 12);
  text_bound(display, " ", "");
  divider();
  const rows: Array<[number, number, number, string, Op]> = [
    [7, 8, 9, "+", (a, b) => a + b],
    [4, 5, 6, "-", (a, b) => a - b],
    [1, 2, 3, "*", (a, b) => a * b],
  ];
  for (const [d1, d2, d3, label, f] of rows) {
    hstack(4, () => {
      btn(`${d1}`, () => digit(d1));
      btn(`${d2}`, () => digit(d2));
      btn(`${d3}`, () => digit(d3));
      key_op(label, f);
    });
  }
  hstack(4, () => {
    btn("C", clear);
    btn("0", () => digit(0));
    btn("=", equals);
    key_op("/", (a, b) => b === 0 ? 0 : a / b);
  });
});
btn("Home", () => browserContext.changePage("/"));
