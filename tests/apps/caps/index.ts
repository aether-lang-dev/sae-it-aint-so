"seeks local-filesystem";
"seeks outgoing-http";
"seeks open-urls";
// A test app for spec_app_caps: each button tries one grant, or one edge of
// one, and shows what happened. See app.json and docs/app-capabilities.md.
const { text, btn, set_text } = ui;

const attempt = (label: string, fn: () => string): void => {
  const out = text(`${label}: (not run)`);
  btn(label, () => {
    try {
      set_text(out, `${label}: ${fn()}`);
    } catch (e) {
      set_text(out, `${label}: refused: ${e.message}`);
    }
  });
};

attempt("write appdata", () => {
  fs.mkdir("$APPDATA/notes");
  fs.write_text("$APPDATA/notes/a.txt", "hello from a sae app");
  return fs.read_text("$APPDATA/notes/a.txt");
});
attempt("list appdata", () => fs.list("$APPDATA/notes").join(","));
attempt("read temp", () => fs.read_text("$TEMP/sae-caps-read/hello.txt"));
attempt("write temp", () => { fs.write_text("$TEMP/sae-caps-read/x.txt", "no"); return "written"; });
attempt("read outside", () => fs.read_text("/etc/hosts"));
attempt("climb out", () => fs.read_text("$APPDATA/../../../../../../../../../../../../../../../../etc/hosts"));
// Through directories that do not exist yet: ".." must not survive to mkdir.
attempt("mkdir climb", () => { fs.mkdir("$APPDATA/../sae-caps-climbed/x"); return "made"; });
// A symlink in $APPDATA (made by the spec) that points out, then "..": the
// kernel follows the link first, so this is outside, not $APPDATA/x.
attempt("symlink climb", () => { fs.write_text("$APPDATA/link/../via_link.txt", "no"); return "written"; });
// A dangling symlink in $APPDATA whose target is outside.
attempt("dangling", () => { fs.write_text("$APPDATA/dangling", "no"); return "written"; });
attempt("remove", () => { fs.remove("$APPDATA/notes/a.txt"); return `exists=${fs.exists("$APPDATA/notes/a.txt")}`; });
attempt("open allowed", () => { shell.open("https://example.com/page"); return "opened"; });
attempt("open other", () => { shell.open("https://evil.example.net/"); return "opened"; });

const patched = text("patch: (not run)");
btn("patch", () =>
  http.request({ method: "PATCH", url: "http://127.0.0.1:8091/api/headers",
                 headers: { "X-Test": "hi" }, body: "b1" },
    (res: any) => set_text(patched, `patch: ${res.status} ${res.text} answer=${res.headers["x-answer"]}`)));
