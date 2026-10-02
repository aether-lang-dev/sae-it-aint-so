// Statements without semicolons.
const a = 1
let b = a + 1
const f = (x: number) => x * 2
print(a, b, f(b))
const t = `no
semis`
print(t)
// expect: 1 2 4
// expect: no
// expect: semis
