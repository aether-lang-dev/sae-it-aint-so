// tests/apps/resize: a page that follows the window (spec_app_resize):
// ui.on_resize tells it the window's size, and it sizes its vg scene to the
// largest square that fits below its texts, with vg.resize (the scene kept:
// a click on it still counts); ui.on_layout tells it its row's width. A
// button resizes the scene by hand, and the refusals are tried at once.
const winSize = state("window: none yet");
const rowSize = state("row: none yet");
const sceneSize = state("scene: 200");
const clicks = state(0);
let board = 0;

ui.text("Resize");
bind(ui.text(""), winSize);
bind(ui.text(""), sceneSize);
bind(ui.text(""), computed(() => `clicks: ${clicks.value}`, clicks));
const row = ui.hstack(() => {
  ui.btn("Make it 120", () => size(120));
  bind(ui.text(""), rowSize);
});
board = vg.scene("0 0 10 10", 200, 200, () => {
  vg.rect(0, 0, 10, 10, () => {
    vg.fill("#3a7d44");
    vg.on_click(() => clicks.set(clicks.value + 1));
  });
});

function size(px: number): void {
  vg.resize(board, px, px);
  sceneSize.set(`scene: ${px}`);
}

ui.on_resize((w: number, h: number) => {
  winSize.set(`window: ${w} x ${h}`);
  // The largest square that fits under the texts and the row, 40 px kept free.
  size(Math.max(40, Math.min(w - 40, h - 200)));
});
ui.on_layout(row, (w: number) => rowSize.set(`row: ${w} wide`));

const refusals: string[] = [];
for (const f of [() => vg.resize(99999, 10, 10), () => vg.resize(board, 0, 10), () => ui.on_layout(99999, () => {}), () => ui.on_resize(5 as never)]) {
  try {
    f();
    refusals.push("none");
  } catch (e) {
    refusals.push(String((e as Error).message));
  }
}
print(`resize: refusals: ${refusals.join(" | ")}`);
