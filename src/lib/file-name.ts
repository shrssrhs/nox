/** Display the original filename for current UUID paths and legacy uploads. */
export function attachmentFilename(value: string): string {
  let path: string;
  try { path = new URL(value).pathname; }
  catch { path = value.split(/[?#]/, 1)[0]; }
  let raw = path.split("/").pop() || "File";
  try { raw = decodeURIComponent(raw); } catch { /* Keep malformed legacy names readable. */ }
  const current = raw.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i);
  if (current) return current[1];
  const legacy = raw.match(/^(.+)-\d{13}(\.[^./]+)$/);
  if (legacy) return legacy[1].toLowerCase().endsWith(legacy[2].toLowerCase()) ? legacy[1] : legacy[1] + legacy[2];
  return raw;
}
