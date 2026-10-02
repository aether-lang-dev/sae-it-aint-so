function f() {
  const x = 1;
  if (x) {
    let x = 2;
  }
}
// error: 4:9: 'x' is declared again in an inner block of the same function
