const KNOWN_FILE_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "csv",
  "xls",
  "xlsx",
  "docx",
]);

export function archiveName(value: string | null | undefined, fallback: string, extension?: string) {
  const cleaned = (value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  if (!extension) return cleaned;
  const existingExtension = cleaned.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (existingExtension && KNOWN_FILE_EXTENSIONS.has(existingExtension)) return cleaned;
  return `${cleaned}.${extension}`;
}

export function archiveExtension(mimeType: string | null | undefined) {
  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "text/csv": "csv",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return mimeType ? extensions[mimeType] : undefined;
}
