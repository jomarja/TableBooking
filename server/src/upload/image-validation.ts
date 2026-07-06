/**
 * Allowlisted raster image types and their real file signatures (magic bytes).
 *
 * SVG is deliberately excluded — it is XML that can carry <script> and would be
 * a stored-XSS vector if served from the API origin. We never trust the
 * client-supplied MIME type or filename; the stored extension is derived from
 * this table and the bytes on disk are verified against it.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function extensionForMime(mime: string): string | null {
  return ALLOWED_IMAGE_TYPES[mime] ?? null;
}

/** Verify the first bytes of a buffer match the claimed image MIME type. */
export function bufferMatchesMime(mime: string, buf: Buffer): boolean {
  const b = buf;
  switch (mime) {
    case 'image/jpeg':
      return b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return (
        b.length > 7 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
      );
    case 'image/gif':
      // "GIF87a" or "GIF89a"
      return b.length > 5 && b.subarray(0, 4).toString('latin1') === 'GIF8';
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return (
        b.length > 11 &&
        b.subarray(0, 4).toString('latin1') === 'RIFF' &&
        b.subarray(8, 12).toString('latin1') === 'WEBP'
      );
    default:
      return false;
  }
}
