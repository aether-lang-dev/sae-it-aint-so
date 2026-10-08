"seeks outgoing-http, reduced functionality without";
"seeks local-filesystem, reduced functionality without";
"seeks open-urls, reduced functionality without";
// globals.ts's survey, from a page that seeks all three privileges, each
// optional: it gets each object only where its context grants it.
const levels: string[] = [];
let o: any = globalThis;
while (o) {
  levels.push(Reflect.ownKeys(o).map((k) => String(k)).sort().join(" "));
  o = Object.getPrototypeOf(o);
}
ui.text(`seeking levels: ${levels.length}`);
levels.forEach((l, i) => ui.text(`S${i}: ${l}`));
