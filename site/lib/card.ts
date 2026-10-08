// A shared component for the site's pages: a titled card with lines in it.
// Imported by site/imports.ts (and the module keeps its own count).
export interface Card { title: string; lines: string[] }
export let made = 0;
export function card(c: Card): number {
  made += 1;
  return ui.vstack(2, () => {
    ui.text(`[${c.title}]`);
    for (const l of c.lines) ui.text(`  ${l}`);
  });
}
export const version = "card 1";
export default function describe(): string { return `${version}, ${made} made`; }
