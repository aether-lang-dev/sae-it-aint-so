// JS-heavy page: build and sort a data set, then show a summary. The kind of
// work a page's logic does before it lays anything out.
var rows = [];
for (var i = 0; i < 20000; i++) {
  rows.push({ id: i, name: "item" + i, score: (i * 7919) % 1000 });
}
rows.sort(function (a, b) { return a.score - b.score || a.id - b.id; });
var total = 0;
for (var j = 0; j < rows.length; j++) total += rows[j].score;
var byBucket = {};
for (var k = 0; k < rows.length; k++) {
  var b = "b" + Math.floor(rows[k].score / 100);
  byBucket[b] = (byBucket[b] || 0) + 1;
}
(function () {
  print("rows: " + rows.length + ", total: " + total);
  for (var key in byBucket) print(key + ": " + byBucket[key]);
})();
