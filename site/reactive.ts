// The reactive surface (docs/roadmap.md 3.4): declare once, never call
// set_text again. state/computed/bind/bind_enabled/bind_hidden/each/batch
// are globals (and on ui); they map onto aether-ui's typed cells, computed_s,
// the property bindings and ui_batch.
const { text, btn, textfield, vstack, hstack, divider } = ui;

interface Todo { id: number; title: string; done: boolean }

const count = state(0);
const name = state("");
const greeting = computed(() => (name.value ? `Hello, ${name.value}` : "Hello, stranger"), name);
const todos = state<Todo[]>([{ id: 1, title: "Read the roadmap", done: false }, { id: 2, title: "Build the camera", done: false }]);
const left = computed(() => todos.value.filter((t) => !t.done).length, todos);
const busy = state(false);
let recomputes = 0;
const first = state("Grace"), last = state("Hopper");
const full = computed(() => { recomputes++; return `${first.value} ${last.value}`; }, first, last);

text("Reactive");
bind(text(""), count);                       // a number state on a label
bind`Count: ${count} of ${10}`;              // the tagged template: a multi-state text
btn("Increment", () => count.update((n) => n + 1));
bind(textfield("Your name", () => {}), name); // two-way: typing updates the state
bind(text(""), greeting);
divider();
bind`${left} left`;
each(todos, "id", (t: Todo, i: number) => {
  hstack(4, () => {
    text(`${i + 1}. ${t.title}${t.done ? " (done)" : ""}`);
    btn(`Done ${t.id}`, () => todos.update((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: true } : x))));
  });
});
btn("Add todo", () => todos.update((ts) => [...ts, { id: ts.length + 1, title: `Todo ${ts.length + 1}`, done: false }]));
btn("Drop first", () => todos.update((ts) => ts.slice(1)));
btn("Reverse", () => todos.update((ts) => [...ts].reverse()));
divider();
const go = btn("Start", () => busy.set(true));
bind_enabled(go, busy, true);                // greyed while busy
const spinner = text("Working...");
bind_hidden(spinner, busy, true);            // shown while busy
btn("Done", () => busy.set(false));
divider();
bind(text(""), full);
btn("Rename (batched)", () => { recomputes = 0; batch(() => { first.set("Ada"); last.set("Lovelace"); }); print(`recomputes: ${recomputes}`); });
btn("Rename (unbatched)", () => { recomputes = 0; first.set("Grace"); last.set("Hopper"); print(`recomputes: ${recomputes}`); });
btn("Home", () => browserContext.changePage("/"));
