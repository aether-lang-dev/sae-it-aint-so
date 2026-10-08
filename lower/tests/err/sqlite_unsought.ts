"seeks outgoing-http";
const rows = sqlite.fred.all("select 1");
// error: 2:14: sqlite needs "seeks database <name>" at the top of the page
