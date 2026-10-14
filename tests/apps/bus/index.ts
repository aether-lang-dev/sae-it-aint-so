"seeks control-bus";
// A test app for spec_app_bus: it serves the control bus, answering each
// command, and can stop and serve again. See app.json and
// docs/control-bus.md.
const { text, btn, set_text } = ui;
let served = 0;
const last = text("last: (none)");
const handler = async (command: string) => {
  served++;
  set_text(last, `last: ${command}`);
  if (command === "boom") throw new Error("the handler failed");
  if (command === "later") return await new Promise((resolve) => setTimeout(() => resolve({ late: true }), 50));
  return { echo: command, served };
};
bus.serve(handler);
btn("stop", () => bus.stop());
btn("serve", () => bus.serve(handler));
