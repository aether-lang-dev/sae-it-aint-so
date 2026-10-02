// A modifier at the top level has nothing to modify: Aether rejects this at
// compile time, the page API throws.
ui.text("Before the misuse");
ui.margin(10, 10, 10, 10);
ui.text("Never reached");
