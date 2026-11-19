const f = (a: number, b?: () => void, c?: () => void) => a;
f(1) { print("a") } { print("b") }
// error: 2:21: only one trailing block follows a call
