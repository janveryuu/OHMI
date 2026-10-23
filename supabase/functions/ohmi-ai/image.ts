/**
 * Bounded image structure and dimension validation for OHMI.
 * Validates PNG and JPEG headers, magic bytes, dimensions, and megapixel bounds.
 */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MiB
export const MAX_DIMENSION_PX = 4096;           // 4096 pixels per side
export const MAX_MEGAPIXELS = 4;                 // 4 megapixels (4,000,000 pixels)

export function isPng(buf: Uint8Array): boolean {
  return buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
}

export function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 3 &&
    buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

export function getPngDimensions(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24 || !isPng(buf)) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export function getJpegDimensions(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 4 || !isJpeg(buf)) return null;
  let offset = 2;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === undefined || marker === 0xFF || marker === 0x00) {
      offset++;
      continue;
    }
    // SOF markers
    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
      if (offset + 9 > buf.length) return null;
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }
    if (marker === 0xDA || marker === 0xD9) {
      break;
    }
    if (offset + 4 > buf.length) return null;
    const length = view.getUint16(offset + 2, false);
    offset += 2 + length;
  }
  return null;
}

export interface ImageValidationResult {
  valid: boolean;
  mimeType?: 'image/png' | 'image/jpeg';
  width?: number;
  height?: number;
  pixels?: number;
  error?: string;
}

export function validateCircuitImage(buf: Uint8Array): ImageValidationResult {
  if (!buf || buf.length === 0) {
    return { valid: false, error: 'Empty file provided' };
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return { valid: false, error: `Image size ${buf.length} bytes exceeds 4 MiB limit` };
  }

  if (isPng(buf)) {
    const dims = getPngDimensions(buf);
    if (!dims) {
      return { valid: false, error: 'Corrupt PNG header or unreadable dimensions' };
    }
    const pixels = dims.width * dims.height;
    if (dims.width > MAX_DIMENSION_PX || dims.height > MAX_DIMENSION_PX) {
      return { valid: false, error: `Image dimensions (${dims.width}x${dims.height}) exceed maximum allowed ${MAX_DIMENSION_PX}px` };
    }
    if (pixels > MAX_MEGAPIXELS * 1_000_000) {
      return { valid: false, error: `Image resolution (${pixels.toLocaleString()} pixels) exceeds ${MAX_MEGAPIXELS} megapixel limit` };
    }
    return {
      valid: true,
      mimeType: 'image/png',
      width: dims.width,
      height: dims.height,
      pixels
    };
  }

  if (isJpeg(buf)) {
    const dims = getJpegDimensions(buf);
    if (!dims) {
      return { valid: false, error: 'Corrupt JPEG header or unreadable dimensions' };
    }
    const pixels = dims.width * dims.height;
    if (dims.width > MAX_DIMENSION_PX || dims.height > MAX_DIMENSION_PX) {
      return { valid: false, error: `Image dimensions (${dims.width}x${dims.height}) exceed maximum allowed ${MAX_DIMENSION_PX}px` };
    }
    if (pixels > MAX_MEGAPIXELS * 1_000_000) {
      return { valid: false, error: `Image resolution (${pixels.toLocaleString()} pixels) exceeds ${MAX_MEGAPIXELS} megapixel limit` };
    }
    return {
      valid: true,
      mimeType: 'image/jpeg',
      width: dims.width,
      height: dims.height,
      pixels
    };
  }

  return { valid: false, error: 'File is not a valid PNG or JPEG image' };
}
