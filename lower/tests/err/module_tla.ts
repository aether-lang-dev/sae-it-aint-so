export const x = 1;
const y = await Promise.resolve(2);
// error: 2:11: top-level await belongs in a page, not a module
