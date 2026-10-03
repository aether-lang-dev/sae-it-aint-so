try { throw 1; } catch (e) {
  try { throw 2; } catch (e) { print(e); }
}
// error: 2:27: a catch inside a catch of the same name (rename one)
