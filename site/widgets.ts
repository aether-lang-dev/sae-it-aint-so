// Widget interactions: a checkbox, a text field, a drop-down, a slider and a
// progress bar, each with a label that shows its state. Ported from
// Tsyne's examples/pages/widget-interactions.ts, which had to `await` every
// read (getChecked, getText); in-process, reads are plain calls.
const { text, btn, divider, toggle, get_toggle, set_toggle, textfield, get_text,
        picker, picker_add, slider, get_slider, set_slider, progressbar, set_progress,
        set_text, hstack } = ui;

text("Widget Interactions");
divider();

let toggles = 0;
const toggle_state = text("Checkbox: off (callbacks: 0)");
const check = toggle("Enable feature", (on: number) => {
  toggles++;
  set_text(toggle_state, `Checkbox: ${on ? "on" : "off"} (callbacks: ${toggles})`);
});
btn("Verify Checkbox", () => print(`checkbox reads ${get_toggle(check)}`));
divider();

const entry_state = text("Entry: (empty)");
const entry = textfield("Type something here", (s: string) => {});
btn("Read Entry", () => set_text(entry_state, `Entry: ${get_text(entry)}`));
divider();

const colours = ["Red", "Green", "Blue"];
const pick_state = text("Selected: (none)");
const pick = picker((i: number) => set_text(pick_state, `Selected: ${colours[i]} (index ${i})`));
for (const c of colours) picker_add(pick, c);
divider();

const slide_state = text("Slider: 50");
const progress = progressbar(0.5);
const slide = slider(0, 100, 50, (v: number) => {
  set_text(slide_state, `Slider: ${Math.round(v)}`);
  set_progress(progress, v / 100);
});
hstack(4, () => {
  btn("Slider to 0", () => { set_slider(slide, 0); set_text(slide_state, "Slider: 0"); set_progress(progress, 0); });
  btn("Slider to 100", () => { set_slider(slide, 100); set_text(slide_state, "Slider: 100"); set_progress(progress, 1); });
  btn("Read Slider", () => print(`slider reads ${Math.round(get_slider(slide))}`));
});
divider();

btn("Check the box from code", () => set_toggle(check, 1));
btn("Back to Home", () => browserContext.changePage("/"));
