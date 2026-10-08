"seeks database fred";
function render() {
  "hide sqlite";
  return sqlite.fred.all("select 1");
}
// error: 4:10: sqlite is hidden here
