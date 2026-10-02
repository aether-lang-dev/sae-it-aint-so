for (const it of items) {
  if (it) break;
  btn(it, () => use(it));
}
// error: 1:25: this loop body declares let/const used by a closure, and also breaks
