// Banking: styles, the CSS-alike. After Swiby's demo/banking (its themes are
// theme/*_theme.rb there; credit Jean Lazarou and the Swiby committers, BSD)
// and Tsyne's styles(). A theme is an object of rules; picking another
// restyles the page in place, as the banking demo's Settings dialog did.
const { vstack, hstack, text, btn, divider, textfield, picker, picker_add,
        styles, add_class, style_id, set_text } = ui;

interface Rule { color?: number | string; background_color?: number | string;
                 font_family?: string; font_weight?: string; font_size?: number }
type Theme = { [selector: string]: Rule };

// Each theme states every property the others do, so switching back really
// undoes the last one (Swiby's reset-sheet convention).
const themes: { [name: string]: Theme } = {
  blue: {
    root: { font_family: "monospace" },
    label: { color: 0x5C458A },
    button: { color: 0x5C458A },
    container: { background_color: 0xD6CFE6 },
    "header.label": { font_weight: "bold", color: 0x6030BF },
    "#balance": { color: "#224488" },
  },
  green: {
    root: { font_family: "serif" },
    label: { color: 0x738040 },
    button: { color: 0x738040 },
    container: { background_color: 0xE1E6CF },
    "header.label": { font_weight: "normal", color: 0xA3BF30 },
    "#balance": { color: "#406030" },
  },
};

styles(themes.blue);

let balance = 1250;
let status: number;

vstack(8, () => {
  add_class(text("Current account"), "header");
  const shown = text(`Balance: ${balance} EUR`);
  style_id(shown, "balance");
  divider();
  add_class(text("Transfer"), "header");
  const amount = textfield("amount", (s: string) => {});
  hstack(4, () => {
    btn("Send", () => {
      const n = parseInt(ui.get_text(amount), 10);
      if (n > 0 && n <= balance) {
        balance -= n;
        set_text(shown, `Balance: ${balance} EUR`);
        set_text(status, `Sent ${n} EUR`);
      } else {
        set_text(status, "Not a valid amount");
      }
    });
  });
  status = text("");
  divider();
  text("Theme:");
  const names = ["blue", "green"];
  const pick = picker((i: number) => {
    styles(themes[names[i]]);
    print(`theme ${names[i]}`);
  });
  for (const n of names) picker_add(pick, n);
});
btn("Back to Home", () => browserContext.changePage("/"));
