// 200 rows of label + button: widget-creation heavy, little JS per widget.
ui.vstack(2, function () {
  for (var i = 0; i < 200; i++) {
    ui.hstack(4, function () {
      ui.text("Row " + i);
      ui.btn("Go " + i, function () { print("row"); });
    });
  }
});
