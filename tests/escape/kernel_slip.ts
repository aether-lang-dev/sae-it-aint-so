"seeks outgoing-http";
// Attempt: not the page's own reach but sae's: while the page's code runs, ask
// the kernel's own code to do something the page's grants do not allow, from
// every kind of entry into the page (docs/design/page-entry-sandbox.md). The
// probe, __sae_probe, is installed only when SAE_SANDBOX_PROBE and
// AETHER_UI_TEST_PORT are set; each of its operations is what a slip in the
// kernel would be (read a file that is not the page's, the environment, a
// connection, exec, a write) and takes nothing from the page. Expected: every
// one refused, in the first run, a click, a timeout, an interval, a frame, a
// promise job, an http reply and a getter the host reads (the context menu's
// label, which tests/spec_escape.ae opens), at a grant depth above 0; and a
// kernel tick the probe runs from inside the entry does nothing (the http
// reply it waits for is not delivered until the entry ends).
const out = ui.text("kernel_slip: trying");
const target = ui.text("kernel_slip: right-click this line");
const report = (s: string) => { ui.set_text(out, s); print(s); };
const P = (globalThis as any).__sae_probe;
const KINDS = ["run", "timeout", "interval", "frame", "promise", "http", "click", "getter"];
const done: string[] = [];
const bad: string[] = [];
let armed = false;
let reported = false;

function probe(kind: string) {
  if (done.includes(kind)) return;
  const results = [P.fs(), P.write(), P.env(), P.tcp(), P.exec()];
  const depth = P.depth();
  const loose = results.filter((r: string) => !r.startsWith("refused")).length;
  if (depth < 1) bad.push(`${kind}: no grant level in force (depth ${depth})`);
  if (loose > 0) bad.push(`${kind}: ${loose} of ${results.length} not refused (${results.join(" | ")})`);
  done.push(kind);
  finish();
}

function finish() {
  if (reported || done.length < KINDS.length) return;
  reported = true;
  report(bad.length === 0
    ? `kernel_slip: refused: ${KINDS.length} kinds of entry, every probe refused`
    : `kernel_slip: ESCAPED ${bad.join("; ")}`);
}

if (!P) {
  report("kernel_slip: ESCAPED: there is no probe (SAE_SANDBOX_PROBE and AETHER_UI_TEST_PORT must be set)");
} else {
  probe("run");
  setTimeout(() => { probe("timeout"); armed = true; print("kernel_slip: armed"); }, 0);
  const iv = setInterval(() => { clearInterval(iv); probe("interval"); }, 5);
  requestAnimationFrame(() => probe("frame"));
  Promise.resolve().then(() => probe("promise"));
  ui.btn("kernel_slip: probe from a click", () => probe("click"));
  ui.context_menu(target, [{ get label() { if (armed) probe("getter"); return "Probe"; }, action: () => {} }]);
  // A kernel tick run from inside this entry must wait: the reply to this
  // request is delivered by http_poll_, which the probe calls in a loop.
  let replied = false;
  http.get("/api/echo?msg=kernel_slip", () => { replied = true; probe("http"); });
  const t0 = Date.now();
  while (Date.now() - t0 < 300) P.tick();
  if (replied) bad.push("a kernel tick ran inside an entry (the http reply was delivered under it)");
}
