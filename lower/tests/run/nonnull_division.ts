// A non-null assertion before a division: x! / y divides; a ! that is not
// postfix may still be followed by a regular expression.
const xs: (number | null)[] = [6, null];
const half = xs[0]! / 2;
const n = 9 as number | undefined;
const third = n! / 3;
const notDigit = !/\d/.test("a");
print(half, third, notDigit);
// expect: 3 3 true
