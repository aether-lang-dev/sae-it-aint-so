// ui.a11y_label, a11y_role, a11y_description and a11y_announce, on a widget
// and on a vg scene; vg.on_key on the scene: a 3 x 3 board with a cursor
// the arrows move and Return marks, each square announced as it is reached
// ("b2, empty"), the board named for where the cursor is.
const { text, btn, a11y_label, a11y_role, a11y_description, a11y_announce } = ui;

a11y_role(text("Accessibility"), "heading");
const gear = a11y_description(a11y_label(btn("⚙", () => a11y_announce(gear, "Settings saved")), "Settings"), "Opens the settings");
const files = "abc";
let cx = 0, cy = 0;
const marked = new Set<string>();
const name = () => `${files[cx]}${3 - cy}`;
const say = () => `${name()}, ${marked.has(name()) ? "marked" : "empty"}`;
let cursor = 0;
const board: number = vg.scene("0 0 30 30", 150, 150, () => {
  for (let r = 0; r < 3; ++r) {
    for (let c = 0; c < 3; ++c) {
      vg.rect(c * 10, r * 10, 10, 10, () => vg.fill((r + c) % 2 ? "#b58863" : "#f0d9b5"));
    }
  }
  cursor = vg.rect(0.5, 0.5, 9, 9, () => { vg.fill("none"); vg.stroke("#1060d0", 1); });
});
a11y_role(board, "group");
const named = () => {
  a11y_label(board, `Board, ${say()}`);
  a11y_description(board, `Marked: ${marked.size ? [...marked].sort().join(", ") : "none"}`);
};
named();
vg.on_key(cursor, (k: string) => {
  const was = name();
  if (k === "Left") cx = Math.max(0, cx - 1);
  else if (k === "Right") cx = Math.min(2, cx + 1);
  else if (k === "Up") cy = Math.max(0, cy - 1);
  else if (k === "Down") cy = Math.min(2, cy + 1);
  else if (k === "Return" || k === "space") {
    if (marked.has(name())) marked.delete(name()); else marked.add(name());
    print(`a11y key: ${k} ${name()}`);
    named();
    a11y_announce(board, marked.has(name()) ? `${name()} marked` : `${name()} cleared`);
    return;
  } else {
    print(`a11y key: ${k} not a move`);
    return;
  }
  vg.set_transform(cursor, `translate(${cx * 10} ${cy * 10})`);
  print(`a11y key: ${k} ${was} to ${name()}`);
  named();
  a11y_announce(board, say());
});
text(`returns its handle: ${gear > 0 && board > 0 ? "yes" : "no"}`);
const refused = (f: () => unknown) => {
  try {
    f();
    return "taken";
  } catch (e) {
    return String((e as Error).message);
  }
};
text(`refused widget: ${refused(() => a11y_label(0, "x"))}`);
text(`refused role: ${refused(() => a11y_role(gear, "spaceship"))}`);
text(`refused key: ${refused(() => vg.on_key(0, () => {}))}`);
