// Attempt: navigate the browser to a file on this machine, as an app: page
// (app:/<path>.ts maps onto <path>.ts in the browser, where there is no app
// folder). Expected: refused and logged; the page stays.
const out = ui.text("chrome_navigate: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
browserContext.changePage("app:/etc/hosts.ts");
report("chrome_navigate: asked for app:/etc/hosts.ts; still here means refused");
