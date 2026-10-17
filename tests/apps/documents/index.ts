"seeks documents";
"seeks print";
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
// A binary file's bytes, as base64 both ways.
attempt("bytes", async () => {
  const d = await documents.pick_open("Open a binary file");
  if (!d) return "cancelled";
  const b64 = await d.read_base64();
  const out = await documents.pick_save("copy.bin");
  if (out) await out.write_base64(b64);
  return `${d.name} is ${b64}`;
});
attempt("what a handle shows", async () => {
  const d = await documents.pick_open();
  return d ? Object.keys(d).sort().join(",") : "cancelled";
});
// fs by a computed name: naming it would need "seeks local-filesystem".
const g: any = globalThis;
attempt("what else is there", async () => `fs ${typeof g["f" + "s"]}, raw ${typeof g.__sae_documents}, frozen ${Object.isFrozen(documents)}`);
// A PDF made here handed to the system's print dialog (capabilities.print);
// under a test aether-ui records it (GET /printed).
const PDF = "JVBERi0xLjQKMSAwIG9iaiA8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4gZW5kb2JqCjIgMCBvYmogPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmogPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSA+PiBlbmRvYmoKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=";  // a one-page PDF, as base64
attempt("print", async () => { printing.pdf(PDF, "A test page"); return "asked"; });
attempt("print not a PDF", async () => { printing.pdf("aGVsbG8=", "x"); return "asked"; });

