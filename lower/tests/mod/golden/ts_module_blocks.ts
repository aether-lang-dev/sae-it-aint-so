import { scale } from "sae:scales";
export type Tick = { at: number };
export const dial = (r: number) => g {
  circle(0, 0, r * scale(1)) { fill("#fdfdf5") }
}
export function row(n: number): void {
  ui.hstack() { btn(`${n}`, () => {}) }
}
