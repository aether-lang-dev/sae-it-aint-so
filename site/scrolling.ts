// Scrolling: a long page in a scroll block. Ported from Tsyne's
// examples/pages/scrolling.ts (label -> text, separator -> divider, vbox ->
// vstack, button(label, { onClick }) -> btn(label, fn)).
const { vstack, scroll, text, btn, divider } = ui;

vstack(4, () => {
  text("Scrolling Demo");
  text("This page demonstrates scrollable content, just like web pages!");
  divider();
  scroll(() => {
    vstack(2, () => {
      text("=== Long Content Below ===");
      for (let i = 1; i <= 100; i++) {
        text(`Line ${i}: This is a line of text to demonstrate scrolling. Scroll down to see more!`);
      }
      text("=== End of Content ===");
      text("You scrolled all the way down!");
    });
  });
  divider();
  btn("Back to Home", () => browserContext.changePage("/"));
});
