// A throw after a top-level await is an uncaught rejection, reported.
print("before");
await Promise.resolve();
throw new Error("after the await");
// expect: before
// expect: uncaught: Error: after the await
