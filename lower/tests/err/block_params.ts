const each = (xs: number[], body?: (x: number) => void) => xs;
each([1, 2]) { |x| print(x) }
// error: 2:16: a trailing block takes no parameters; write an arrow
