// State lives in the page's JS context until the page is left.
let n: number = 0;
const bump = (by: number = 1): void => {
  n += by;
  print(`count ${n}`);
};

ui.text("Counter page");
ui.btn("Increment", () => bump());
ui.btn("Home", () => browserContext.changePage("/"));
