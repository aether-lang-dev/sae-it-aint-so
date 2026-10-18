// Context menus: a page's own, on a widget, on a vg shape and on the whole
// page, each above sae's own section (Back, Forward, Reload, View page
// source, Inspect), which a page cannot take a label of. The items array is
// read again each time the menu opens, so changing it changes the menu.
const { text, btn, context_menu, set_text } = ui;
const { scene, rect, fill, on_right_click } = vg;

text("Context menus");
const status = text("chose: nothing");
const target = text("Right-click this line");
const items: any[] = [
  { label: "Copy", accel: "Ctrl+C", action: () => set_text(status, "chose: Copy") },
  "-",
  { label: "Paste", enabled: false },
];
context_menu(target, items);
btn("Add an item", () => { items.push({ label: "Added", action: () => set_text(status, "chose: Added") }); });

// The whole page's: a right click anywhere with nothing deeper of its own.
context_menu(0, [{ label: "Page item", action: () => set_text(status, "chose: Page item") }]);

// A shape's menu, and another shape's plain right click.
let shape = 0;
scene("0 0 200 60", 200, 60, () => {
  shape = rect(0, 0, 100, 60, () => fill("#c8d8f0"));
  rect(100, 0, 100, 60, () => {
    fill("#f0d8c8");
    on_right_click(() => set_text(status, "right-clicked the other shape"));
  });
});
context_menu(shape, [{ label: "Shape item", action: () => set_text(status, "chose: Shape item") }]);

// sae's own labels are refused, as is an item that does nothing.
for (const bad of [[{ label: "Reload", action: () => {} }], [{ label: " view page source ", action: () => {} }], [{ label: "Nothing" }]]) {
  try { context_menu(0, bad); print("not refused"); } catch (e) { print(`refused: ${(e as Error).message}`); }
}
