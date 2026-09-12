const ASCII_HEADER_VALUE = /^[\x20-\x7E]+$/;

function encodeFilename(filename: string) {
  return encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function asciiFilename(filename: string, fallback: string) {
  const extension = filename.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? "";
  const basename = extension ? filename.slice(0, -extension.length) : filename;
  const asciiBasename = basename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\\r\n]/g, "_")
    .replace(/_+/g, "_")
    .trim()
    .replace(/^[_\s]+|[_\s]+$/g, "");

  return `${asciiBasename || fallback}${extension}`;
}

export function contentDisposition(
  disposition: "inline" | "attachment",
  requestedFilename: string | null | undefined,
  fallback = "document",
) {
  const filename = requestedFilename?.trim() || fallback;
  const ascii = asciiFilename(filename, fallback);
  const base = `${disposition}; filename="${ascii}"`;

  if (ASCII_HEADER_VALUE.test(filename) && filename === ascii) return base;
  return `${base}; filename*=UTF-8''${encodeFilename(filename)}`;
}
