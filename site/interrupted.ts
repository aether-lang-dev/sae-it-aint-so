// ui.on_interrupted(fn): told when the page's time limit stopped an entry
// into its JS. tests/spec_interrupted.ae reads the "name: value" lines below.
const { text, set_text, btn, on_interrupted } = ui;

let told = 0;
const toldL = text("told: 0");
on_interrupted(() => { told++; set_text(toldL, `told: ${told}`); });

let clicks = 0;
const clicksL = text("clicks: 0");
btn("Count", () => { clicks++; set_text(clicksL, `clicks: ${clicks}`); });

// A job after an await never resumes once stopped, and runs no finally.
let finallyRan = 0;
const finallyL = text("finally: 0");
btn("Hang in a job", async () => {
  try {
    await null;
    for (;;) {}
  } finally {
    finallyRan++;
    set_text(finallyL, `finally: ${finallyRan}`);
  }
});

// Stopped in the handler itself, before any await.
btn("Hang in a handler", () => { for (;;) {} });

// Array.prototype.find stopped by the time limit between two elements: in
// quickjs-ng 0.18.0 the native find freed the element before last a second
// time, an object the array still held (asks/quickjs-array-find-interrupt.md;
// sae's prelude puts a find of its own in front). The callback has no loop,
// so the only places the limit can stop the page are find's own steps. The
// engine looks at the clock every 10,000 steps: a length that is no multiple
// of that keeps the step it looks at from landing on the first element,
// where nothing had been freed yet.
let items: { n: number }[] = [];
const itemsL = text("items: none");
btn("Find past the limit", () => {
  items = [];
  for (let i = 0; i < 20011; i++) items.push({ n: i });
  set_text(itemsL, "items: made");
  for (;;) items.find((o) => o.n < 0);
});
// New objects take any freed one's memory, then each element is checked.
btn("Check the items", () => {
  const fresh: { n: number }[] = [];
  for (let j = 0; j < 1000; j++) fresh.push({ n: -1 });
  let bad = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].n !== i) { bad = i; break; }
  }
  const said = bad < 0 ? `items: ${items.length} intact` : `items: corrupt at ${bad}`;
  print(said);
  set_text(itemsL, said);
});
