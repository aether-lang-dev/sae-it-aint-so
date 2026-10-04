// Loops forever. The engine stops each entry into a page's JS after a time
// limit, so this page is interrupted, not the browser hung.
ui.text("Before the loop");
for (;;) {}
ui.text("Never reached");
