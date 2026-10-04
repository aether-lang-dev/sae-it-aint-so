"seeks local-filesystem";
function save(text: string) {
  "hide fs";
  fs.write_text("$APPDATA/a.txt", text);
}
// error: 4:3: fs is hidden here
