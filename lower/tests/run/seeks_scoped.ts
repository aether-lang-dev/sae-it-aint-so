"seeks outgoing-http GET,POST /api/*";
"seeks outgoing-http GET https://api.example.com/v1/**";
"seeks local-filesystem, reduced functionality without";
// Scoped and optional seeks: the page may name http and fs, and lowers to
// the same JavaScript (the directives stay as harmless string statements).
const where: string = typeof http === "undefined" ? "no http" : "http named";
print(where);
print(typeof fs === "undefined" ? "fs absent" : "fs present");
// expect: no http
// expect: fs absent
