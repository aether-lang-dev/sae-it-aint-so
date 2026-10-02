// Throws half way through layout: the widgets before the throw stay.
ui.text("Before the error");
ui.vstack(2, function () {
  ui.text("Inside the block");
  undefinedFunction();
});
ui.text("Never reached");
