// Shorthand properties and methods; ES5 accessors pass through.
const size = 3;
const label = "box";
const shape = {
  size,
  label,
  area(): number { return this.size * this.size; },
  describe<T>(extra: T) { return this.label + ":" + extra; },
  get double() { return this.size * 2; },
};
print(shape.size, shape.label, shape.area(), shape.describe("x"), shape.double);
// expect: 3 box 9 box:x 6
