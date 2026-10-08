// Re-exports: everything of counter.ts, one renamed, and a namespace.
export * from "./counter.ts";
export { inc as bump } from "./counter.ts";
export * as counter from "./counter.ts";
export const extra = 1;
