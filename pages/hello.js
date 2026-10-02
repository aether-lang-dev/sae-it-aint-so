// Spike page, ES5: the shape a lowered page will have.
var clicks = 0;
ui.text("Hello from a page.");
ui.divider();
ui.hstack(8, function () {
  ui.text("Row of things:");
  ui.btn("Click me", function () {
    clicks = clicks + 1;
    print("clicked " + clicks);
  });
});
ui.vstack(2, function () {
  for (var i = 0; i < 5; i++) {
    ui.text("Item " + i);
  }
});
print("page built");
