// A type alias written one union member, or one conditional branch, a line:
// the leading '|', '&', '?' and ':' carry the declaration on.
type Shape =
  | { readonly kind: "circle"; r: number }
  | { readonly kind: "square"; side: number };
type Named =
  & { name: string }
  & { id: number };
type Unwrap<T> = T extends Array<infer U>
  ? U
  : T;
const area = (s: Shape): number => (s.kind === "circle" ? 3 * s.r * s.r : s.side * s.side);
const n: Named = { name: "x", id: 1 };
const u: Unwrap<number[]> = 7;
print(area({ kind: "circle", r: 1 }), area({ kind: "square", side: 2 }), n.name, u);
// The statement after the alias is still a statement.
let after = 1
;[after] = [2]
print(after)
// expect: 3 4 x 7
// expect: 2
