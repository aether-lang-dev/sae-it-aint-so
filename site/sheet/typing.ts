// A formula as it is typed: the colours its references are drawn in (as
// Excel colours them, one each in order), and whether the caret is where a
// reference may go, so a click on a cell puts the cell's reference there
// (point mode): after the '=', an operator, '(', ',' or ':', spaces aside.
export const REFERENCE_COLOURS = ["#1f6fd1", "#d1495b", "#7a40b5", "#1e9e5a", "#d9822b", "#0a9396"];

export function pointable(text: string, caret: number): boolean {
  if (!text.startsWith("=")) return false;
  const before = text.slice(0, caret).trimEnd();
  return /[=+\-*/^&(,:<>]$/.test(before);
}
