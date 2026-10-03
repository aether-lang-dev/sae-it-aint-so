// Dynamic updates: content that changes without a page load. Ported from
// Tsyne's examples/pages/dynamic-demo.ts. Tsyne's list could not redraw (its
// handlers only logged); here ui.clear + ui.into rebuild it in place.
const { vstack, hstack, text, btn, divider, textfield, get_text, set_text, clear, into } = ui;

let counter = 0;
let items: string[] = ["Initial Item 1", "Initial Item 2", "Initial Item 3"];

const show_items = (list: number): void => {
  clear(list);
  into(list, () => {
    if (items.length === 0) text("(no items)");
    items.forEach((item: string, i: number) => text(`  ${i + 1}. ${item}`));
  });
  print(`items: ${items.length}`);
};

const first = text("Dynamic Updates Demo");
text("Content updates without reloading the page");
divider();

text("=== Dynamic Counter ===");
const display = text(`Count: ${counter}`);
hstack(4, () => {
  btn("-", () => set_text(display, `Count: ${--counter}`));
  btn("Reset", () => { counter = 0; set_text(display, `Count: ${counter}`); });
  btn("+", () => set_text(display, `Count: ${++counter}`));
});
divider();

text("=== Dynamic List ===");
const name = textfield("New item name", (s: string) => {});
const list = vstack(2, () => {});
hstack(4, () => {
  btn("Add Item", () => {
    const typed = get_text(name);
    items.push(typed !== "" ? typed : `Item ${items.length + 1}`);
    show_items(list);
  });
  btn("Remove Last", () => { items.pop(); show_items(list); });
  btn("Clear All", () => { items = []; show_items(list); });
});
show_items(list);
divider();

// The page may change only widgets it made. The address bar, the status
// line and the rest of the chrome are the browser's: naming one throws, and
// the page carries on. Handles below the page's first widget are the
// browser's (and past pages'), so try every one of them.
btn("Try to rewrite the browser", () => {
  let refused = 0;
  for (let h = 1; h < first; h++) {
    try {
      set_text(h, "https://example.com/not-really");
    } catch (e) {
      refused++;
    }
  }
  print(refused === first - 1 ? `refused all ${refused}` : `refused only ${refused} of ${first - 1}`);
});
btn("Back to Home", () => browserContext.changePage("/"));
