// A vg shape needs an open vg.scene(); outside one it throws.
ui.text("Before the vg misuse");
vg.circle(10, 10, 5);
ui.text("Never reached");
