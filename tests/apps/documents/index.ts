"seeks documents";
// A test app for spec_app_documents: each button asks the person (the spec,
// answering the picker) for a file, and shows what the page got. See
// app.json and docs/page-services.md, section 5.
const { text, btn, set_text } = ui;

const attempt = (label: string, fn: () => Promise<string>): void => {
  const out = text(`${label}: (not run)`);
  btn(label, () => {
    fn().then((r) => set_text(out, `${label}: ${r}`), (e) => set_text(out, `${label}: refused: ${e.message}`));
  });
};

attempt("open", async () => {
  const d = await documents.pick_open("Open a sheet");
  return d ? `${d.name} says ${await d.read_text()}` : "cancelled";
});
attempt("save", async () => {
  const d = await documents.pick_save("budget.json");
  if (!d) return "cancelled";
  await d.write_text(`{"saved":true}`);
  return `saved ${d.name}`;
});
attempt("what a handle shows", async () => {
  const d = await documents.pick_open();
  return d ? Object.keys(d).sort().join(",") : "cancelled";
});
// fs by a computed name: naming it would need "seeks local-filesystem".
const g: any = globalThis;
attempt("what else is there", async () => `fs ${typeof g["f" + "s"]}, raw ${typeof g.__sae_documents}, frozen ${Object.isFrozen(documents)}`);
