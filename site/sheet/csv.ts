// CSV (RFC 4180): rows of fields, a field with a comma, a quote or a line
// break in quotes, a quote in it doubled. Written with \n between rows;
// read with \n or \r\n, a last line break or none, and fields split by a
// comma or another delimiter (Text to Columns' tab, space, ;).

const quoted = (field: string): string => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field);

export const toCsv = (rows: readonly (readonly string[])[]): string => rows.map((row) => row.map(quoted).join(",")).join("\n");

export function fromCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", i = 0, line = 1;
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); rows.push(row); row = []; line++; };
  while (i < text.length) {
    const c = text[i];
    if (c === '"' && field === "") {
      const from = line;
      for (i++; ; i++) {
        if (i >= text.length) throw new RangeError(`a quoted field that never ends, on line ${from}`);
        if (text[i] === '"') {
          if (text[i + 1] !== '"') break;
          i++;
        }
        if (text[i] === "\n") line++;
        field += text[i];
      }
      i++;
      if (i < text.length && text[i] !== delimiter && !/[\r\n]/.test(text[i])) throw new RangeError(`text after a closing quote, on line ${from}`);
      continue;
    }
    if (c === delimiter) endField();
    else if (c === "\n") endRow();
    else if (c === "\r" && text[i + 1] === "\n") { endRow(); i++; }
    else field += c;
    i++;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}
