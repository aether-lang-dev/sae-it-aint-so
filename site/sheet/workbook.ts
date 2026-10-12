// The workbook: everything a spreadsheet holds, with no ui. The Sheet (inputs,
// values, the graph, undo), what cells carry besides their inputs (notes),
// the two formula languages (the major setting), the file's name and setup
// script, the clipboard, and each conditional style as last worked out. It
// answers what a cell shows, its style and its status line. Commands
// (commands.ts) change it; the page's panels read it.
import type { Addr } from "./address.ts";
import { EXCEL } from "./excel.ts";
import { describe, show } from "./format.ts";
import { formatted, toStyle } from "./formats.ts";
import type { Language } from "./language.ts";
import { CellNotes } from "./notes.ts";
import type { Note } from "./notes.ts";
import { RexxLanguage } from "./rexx.ts";
import { Sheet } from "./sheet.ts";
import { CellError } from "./values.ts";
import { check } from "./validation.ts";

export type LanguageName = "Excel" | "RexxJS";

// What was copied, from where, in which language (so a paste moves its
// formulas): as tab-separated text, and cell by cell (inputs, what they
// showed, their notes) for Paste Special. Pages have no system clipboard yet.
export interface Clip {
  readonly tsv: string;
  readonly from: Addr;
  readonly language: Language;
  readonly inputs: readonly (readonly string[])[];
  readonly shown: readonly (readonly string[])[];
  readonly notes: readonly (readonly Note[])[];
}

export class Workbook {
  readonly sheet = new Sheet();
  readonly notes = new CellNotes();
  readonly rexx = new RexxLanguage();
  name = "Untitled";
  setupScript = "";
  clip: Clip | null = null;
  #conditional = new Map<string, string>();
  // Circle Invalid: on, the cells whose input breaks their rule are marked.
  circling = false;
  #circled = new Set<string>();

  language(name: LanguageName): Language {
    return name === "Excel" ? EXCEL : this.rexx;
  }

  // Every conditional style worked out again, in the sheet's language, after
  // a change (it may read any cell).
  async restyle(): Promise<void> {
    const next = new Map<string, string>();
    for (const [key, expr] of this.notes.conditional()) next.set(key, toStyle(await this.sheet.evaluate(expr)));
    this.#conditional = next;
    this.#circled = new Set(this.circling ? this.invalid() : []);
  }

  // The cells whose input breaks their rule, whenever it was typed, in sheet
  // order.
  invalid(): string[] {
    return this.sheet.keys().filter((k) => {
      const rule = this.notes.get(k).validation;
      return rule && check({ ...rule, when: "always" }, this.sheet.input(k), false) !== null;
    });
  }

  // What a cell shows: its value in its number format.
  textOf(key: string): string {
    const v = this.sheet.value(key);
    return formatted(v, this.notes.get(key).format ?? "") ?? show(v);
  }

  // Its style, each layer over the last: numbers to the right, its own
  // style, its format's style parts, its conditional style, a circle (its
  // input breaks its rule), an error in red.
  styleOf(key: string): string {
    const v = this.sheet.value(key), n = this.notes.get(key);
    return [typeof v === "number" ? "text-align: end" : "", toStyle(n.style), toStyle(n.format), this.#conditional.get(key) ?? "",
      this.#circled.has(key) ? "background: #ffd6d6" : "", v instanceof CellError ? "color: #c0392b" : ""].filter((p) => p).join("; ");
  }

  // The status line for a cell.
  describe(key: string): string {
    return describe(key, this.sheet.input(key), this.sheet.value(key), this.notes.get(key).comment);
  }
}
