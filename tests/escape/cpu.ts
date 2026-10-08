// Attempt: loop forever. Expected: the engine stops the entry (InternalError:
// interrupted), reported once; the browser is not hung.
ui.text("cpu: trying");
for (;;) {}
ui.text("cpu: ESCAPED");
