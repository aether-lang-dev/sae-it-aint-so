// Attempt: navigate above the site's root with "..": "../../../etc/hosts"
// resolves to http://<origin>/../../../etc/hosts, which a server might map
// anywhere (and app:/../x would read a file outside an app's bundle).
// Expected: the path is normalised like an import's; a climb above the root
// is refused and logged once; the page stays.
const out = ui.text("climb: trying");
const report = (s: string) => { ui.set_text(out, s); print(s); };
browserContext.changePage("../../../etc/hosts");
setTimeout(() => report("climb: refused: still here 200 ms after asking for ../../../etc/hosts"), 200);
