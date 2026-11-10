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
