export function normalizeGoogleSheetCode(value: unknown) {
  const input = String(value || "").trim();
  if (!input) return null;
  const urlMatch = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i);
  const code = (urlMatch?.[1] || input).trim();
  if (!/^[A-Za-z0-9_-]{15,}$/.test(code)) {
    throw new Error("Enter a valid Google Sheet code or paste the complete Google Sheet URL.");
  }
  return code;
}
