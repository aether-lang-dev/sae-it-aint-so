"seeks control-bus";
// A test app for spec_app_bus: it serves the control bus, answering each
// command, and can stop and serve again. See app.json and
// docs/control-bus.md.
const { text, btn, set_text } = ui;
let served = 0;
const last = text("last: (none)");
const stops = text("stopped: (none)");
let stopped_count = 0;
const handler = async (command: string) => {
  served++;
  set_text(last, `last: ${command}`);
  if (command === "boom") throw new Error("the handler failed");
  if (command === "later") return await new Promise((resolve) => setTimeout(() => resolve({ late: true }), 50));
  // Past the page's time limit: the limit stops it, mid-loop.
  if (command === "spin") { let n = 0; for (;;) n++; }
  // Never settles: the bus's deadline answers for it.
  if (command === "hang") return await new Promise(() => {});
  return { echo: command, served };
};
// What the app is told when a request was answered without it.
const stopped = (reason: string) => {
  stopped_count++;
  set_text(stops, `stopped: ${reason} (${stopped_count})`);
};
bus.serve(handler, stopped);
btn("stop", () => bus.stop());
btn("serve", () => bus.serve(handler, stopped));
