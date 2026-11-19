const f = (body?: () => void) => body;
(f) { print("x") }
// error: 2:5: a trailing block follows a call's ')' or a name
