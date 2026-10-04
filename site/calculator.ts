// The calculator, in Tsyne's shape on aether-ui's grid: sixteen keys spelled
// out in one string and spread into a 4-column grid, filled a row at a time
// (aether-ui's examples/calculator is the same grid, in Aether).
const { vstack, grid, equal_cells, btn, button, bg_color, onclick, divider,
        text_bound, ui_state, ui_set, margin } = ui;

type Op = (a: number, b: number) => number;
const OPS: { [k: string]: Op } = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => (b === 0 ? a : a / b),
};

let num = 0, prev = 0;
let op: Op = (a, b) => a;
const display = ui_state(0);

const digit = (d: string) => { num = num * 10 + +d; ui_set(display, num); };
const operator = (k: string) => { prev = num; num = 0; op = OPS[k]; ui_set(display, 0); };
const equals = () => { num = op(prev, num); prev = 0; ui_set(display, num); };
const clear = () => { num = 0; prev = 0; ui_set(display, 0); };

const key = (k: string) => {
  if (k in OPS) {
    button(k, () => { bg_color(0.95, 0.85, 0.5, 1.0); onclick(() => operator(k)); });
  } else if (k === "C") {
    button(k, () => { bg_color(0.9, 0.6, 0.6, 1.0); onclick(clear); });
  } else if (k === "=") {
    btn(k, equals);
  } else {
    btn(k, () => digit(k));
  }
};

vstack(() => {
  margin(12, 12, 12, 12);
  text_bound(display, " ", "");
  divider();
  grid(4, () => {
    equal_cells();
    [..."789+456-123*0C=/"].forEach(key);
  });
});
btn("Home", () => browserContext.changePage("/"));
