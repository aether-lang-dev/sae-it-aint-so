// The loader object a lowered unit's wrapper takes ($sae), in JavaScript,
// for the lowerer's module tests (lower/run-tests.sh). sae's host provides
// the real one (src/sae_host.ae, "wave1/imports"), which resolves a
// specifier against the importer's URL; this one keys modules by the
// path relative to the test directory ("lib/x.ts", "sae:x") and resolves a
// "./" or "../" specifier against the importer's. The x and all methods are
// the same as the host's.
var __mods = new Map();
function __resolve(base, spec) {
  if (spec.indexOf("sae:") === 0) return spec;
  var parts = base.split("/").slice(0, -1);
  spec.split("/").forEach(function (seg) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  });
  return parts.join("/");
}
function __loader(url) {
  return {
    url: url,
    m: function (spec) {
      var key = __resolve(url, spec);
      if (!__mods.has(key)) throw new Error("not loaded: " + key + " (from " + url + ")");
      return __mods.get(key);
    },
    x: function (e) {
      for (var i = 1; i + 1 < arguments.length; i += 2) {
        Object.defineProperty(e, arguments[i], { get: arguments[i + 1], enumerable: true, configurable: true });
      }
    },
    all: function (e, ns) {
      Object.keys(ns).forEach(function (k) {
        if (k !== "default" && !(k in e)) {
          Object.defineProperty(e, k, { get: function () { return ns[k]; }, enumerable: true, configurable: true });
        }
      });
    }
  };
}
function __module(spec, fn) {
  var e = {};
  fn(__loader(spec), e);
  __mods.set(spec, e);
}
function __page(name, fn) {
  var p = fn(__loader(name));
  if (p && typeof p.then === "function") p.then(null, function (e) { print("uncaught: " + e); });
}
