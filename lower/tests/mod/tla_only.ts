// A page with a top-level await and no import still works, and an await
// inside a function is not a top-level one.
async function f(): Promise<number> { return await Promise.resolve(3); }
print("start");
print(await f());
print("end");
// expect: start
// expect: 3
// expect: end
