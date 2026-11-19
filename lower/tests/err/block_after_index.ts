const fs = [(body?: () => void) => body];
fs[0] { print("x") }
// error: 2:7: a trailing block follows a call's ')' or a name
