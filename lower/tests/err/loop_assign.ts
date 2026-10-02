for (let i = 0; i < 3; i++) {
  btn("x", () => use(i));
  i += 1;
}
// error: 3:3: 'i' is a loop variable captured per iteration
