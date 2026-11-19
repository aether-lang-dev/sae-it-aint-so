// Attempt: hand the host a value whose getter loops forever, to be read after
// this script has returned. The context menu's items are read again each
// time the menu opens, from a click, outside any entry into the page: the
// label getter below is fine while the script runs (the check at
// registration passes) and loops once the page has armed it. Expected: the
// host stops the loop at the page's time limit, says so once, stays alive,
// and the next page works. The page cannot report this one (the host's own
// code was in the loop), so tests/spec_escape.ae reads the console.
const out = ui.text("menu_getter: trying");
const target = ui.text("right-click this line");
let armed = false;
const items = [{ get label() { if (armed) for (;;) {} return "Bomb"; }, action: () => {} }];
ui.context_menu(target, items);
setTimeout(() => { armed = true; ui.set_text(out, "menu_getter: armed"); print("menu_getter: armed"); }, 0);
