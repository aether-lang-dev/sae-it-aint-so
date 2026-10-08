// Top-level await: the page is wrapped in an async function.
import { twice } from "./lib/counter.ts";
const v = await Promise.resolve(twice(4));
print("awaited", v);
for await (const x of [Promise.resolve(1), 2]) print("for await", x);
const after = await new Promise<number>((ok) => queueMicrotask(() => ok(5)));
print("after", after);
// expect: awaited 8
// expect: for await 1
// expect: for await 2
// expect: after 5
