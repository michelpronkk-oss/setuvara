/**
 * CSV for spreadsheets. Cells that a spreadsheet would run as a formula (=, +, -, @, tab, CR)
 * get a leading apostrophe, so an entrant's name can never execute in the creator's sheet.
 */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
