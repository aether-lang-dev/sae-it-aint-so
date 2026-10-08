// A module for the lowerer's tests: every export form.
export let count = 0;
export const name: string = "counter", limit = 10;
export function inc(by: number = 1): number { count += by; return count; }
export class Counter {
  n = 0;
  tick(): number { return ++this.n; }
}
const hidden = "not exported";
function twice(x: number): number { return x * 2; }
export { twice, hidden as shown };
export default function describe(): string { return `${name} at ${count} of ${limit}`; }
