class C { constructor(b?: () => void) {} }
new C() { print("x") }
// error: 2:9: a trailing block follows a call's ')' or a name
