// Home page, in the page dialect: TypeScript that erases, ES2015 that lowers.
interface Link {
  label: string;
  href: string;
}

const { text, btn, divider } = ui;

const links: Link[] = [
  { label: "About", href: "/about" },
  { label: "Counter", href: "/counter" },
  { label: "Calculator", href: "/calculator" },
  { label: "Form", href: "/form" },
  { label: "Dynamic updates", href: "/dynamic" },
  { label: "Scrolling", href: "/scrolling" },
  { label: "Widget interactions", href: "/widgets" },
  { label: "Banking (styles)", href: "/banking" },
  { label: "HTTP from a page", href: "/http" },
  { label: "Vector graphics", href: "/vg" },
  { label: "Vector graphics misuse", href: "/vgmisuse" },
  { label: "Modifier misuse", href: "/misuse" },
  { label: "A page that is not there", href: "/nowhere" },
  { label: "Old home (302 to /)", href: "/old-home" },
  { label: "A page that throws", href: "/broken" },
  { label: "A page outside the dialect", href: "/unsupported" },
  { label: "A page that seeks the file system", href: "/seeks_fs" },
  { label: "A page that uses what it did not seek", href: "/unsought" },
];

text("Welcome to Sae it ain't so");
text(`You are at ${browserContext.currentUrl}`);
divider();
for (const link of links) {
  btn(link.label, () => browserContext.changePage(link.href));
}
