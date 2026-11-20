export type Tick = { at: number };
export const ticks = (n: number): Tick[] => [{ at: n }];
