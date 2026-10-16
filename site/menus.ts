// ui.menu in a web page: refused. Only an installed app has a menu bar
// (tests/apps/menus, spec_app_menus); a page in the browser may not change
// the browser's own menus.
let why = "";
try {
  ui.menu("Game", () => ui.menu_item("New game", () => {}));
} catch (e) {
  why = String((e as Error).message);
}
ui.text("Menus in a web page");
ui.text(`refused: ${why}`);
