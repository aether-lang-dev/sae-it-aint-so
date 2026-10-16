// An installed app with a menu bar (ui.menu, ui.menu_item, ui.menu_separator):
// two menus, their items bumping a bound counter, and the refusals said.
const taken = state(0);
const said = state("");

ui.menu("Game", () => {
  ui.menu_item("New game", () => { taken.set(taken.value + 1); said.set("new game"); });
  ui.menu_separator();
  ui.menu_item("Flip board", () => { taken.set(taken.value + 1); said.set("flipped"); });
});
ui.menu("Help", () => {
  ui.menu_item("About", () => said.set("about"));
});

let nested = "";
try {
  ui.menu("Outer", () => ui.menu("Inner", () => {}));
} catch (e) {
  nested = String((e as Error).message);
}
let stray = "";
try {
  ui.menu_item("Stray", () => {});
} catch (e) {
  stray = String((e as Error).message);
}

ui.text("Menus");
bind(ui.text(""), computed(() => `Actions taken: ${taken.value}`, taken));
bind(ui.text(""), computed(() => `Last: ${said.value}`, said));
ui.text(`nested: ${nested}`);
ui.text(`stray: ${stray}`);
