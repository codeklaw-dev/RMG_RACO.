// Upload validation that doesn't trust the browser: the declared type must
// match the file's actual leading bytes after upload. (Pure; unit-tested.)
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];

export function sniffImageType(b: Uint8Array): AllowedType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type UploadCheck = { ok: true } | { ok: false; reason: string };

export function checkUploaded(declared: { contentType: string; sizeBytes: number }, actual: { size: number; prefix: Uint8Array }, maxBytes: number): UploadCheck {
  if (actual.size !== declared.sizeBytes) return { ok: false, reason: "size_mismatch" };
  if (actual.size > maxBytes) return { ok: false, reason: "too_large" };
  const sniffed = sniffImageType(actual.prefix);
  if (!sniffed) return { ok: false, reason: "not_an_image" };
  if (sniffed !== declared.contentType) return { ok: false, reason: "type_mismatch" };
  return { ok: true };
}

/** Display-safe file name (stored as metadata only; never used in object keys). */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "upload";
