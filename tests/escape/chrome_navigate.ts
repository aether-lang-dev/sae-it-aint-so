// Attempt: navigate the browser to a file on this machine, as an app: page
// (app:/<path>.ts maps onto <path>.ts in the browser, where there is no app
// folder). Expected: refused and logged; the page stays, and says so once
// the deferred navigation would have happened.
const out = ui.text("chrome_navigate: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
browserContext.changePage("app:/etc/hosts.ts");
setTimeout(() => report("chrome_navigate: refused: still here 200 ms after asking for app:/etc/hosts.ts"), 200);
