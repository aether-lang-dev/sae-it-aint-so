// A sheet file, in the Tauri spreadsheet's format (its .json and .rexxsheet
// files): a name, a setup script, and cells, each a value or an expression
// (a formula without its '='), with a comment and a format. Its formulas are
// RexxJS, as the app's are, unless the file says "formulas": "excel".
export interface SheetFile {
  readonly name: string;
  readonly language: "Excel" | "RexxJS";
  readonly setupScript: string;
  readonly entries: readonly [string, string][];   // [key, input] for Sheet.setMany
  readonly comments: ReadonlyMap<string, string>;
  readonly formats: ReadonlyMap<string, string>;
}

interface FileCell {
  readonly value?: unknown;
  readonly expression?: string | null;
  readonly comment?: string | null;
  readonly format?: string | null;
}

export function readSheetFile(data: any): SheetFile {
  const cells = Object.entries((data?.cells ?? {}) as Record<string, FileCell>);
  const some = (field: "comment" | "format") =>
    new Map(cells.filter(([, c]) => c[field]).map(([k, c]) => [k.toUpperCase(), String(c[field])]));
  return {
    name: String(data?.name ?? "Untitled"),
    language: String(data?.formulas ?? "").toLowerCase() === "excel" ? "Excel" : "RexxJS",
    setupScript: String(data?.setupScript ?? ""),
    entries: cells.map(([k, c]): [string, string] =>
      [k.toUpperCase(), c.expression ? `=${c.expression}` : String(c.value ?? "")]),
    comments: some("comment"),
    formats: some("format"),
  };
}
