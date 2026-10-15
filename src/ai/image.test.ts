import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  isPng,
  isJpeg,
  getPngDimensions,
  getJpegDimensions,
  validateCircuitImage,
  MAX_IMAGE_BYTES,
  MAX_DIMENSION_PX
} from './image';

describe('pure image validation module', () => {
  it('identifies PNG and parses dimensions correctly from header', () => {
    // Construct synthetic 100x200 PNG header
    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0); // PNG magic
    header.set([0x00, 0x00, 0x00, 0x0D], 8); // chunk len 13
    header.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
    const view = new DataView(header.buffer);
    view.setUint32(16, 100, false); // width 100
    view.setUint32(20, 200, false); // height 200

    expect(isPng(header)).toBe(true);
    expect(isJpeg(header)).toBe(false);
    expect(getPngDimensions(header)).toEqual({ width: 100, height: 200 });

    const result = validateCircuitImage(header);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(result.pixels).toBe(20000);
  });

  it('validates the approved OHMI mascot PNG', async () => {
    const mascotPath = resolve('assets/mascot/ohmi-pixel-front.png');
    const bytes = new Uint8Array(await readFile(mascotPath));
    const result = validateCircuitImage(bytes);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.pixels).toBeLessThanOrEqual(4_000_000);
  });

  it('identifies JPEG and parses dimensions from SOF marker', () => {
    // Construct synthetic 640x480 JPEG
    const buf = new Uint8Array(20);
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; // SOI + marker start
    buf[3] = 0xC0; // SOF0
    const view = new DataView(buf.buffer);
    view.setUint16(4, 11, false); // length
    buf[6] = 8; // precision
    view.setUint16(7, 480, false); // height
    view.setUint16(9, 640, false); // width

    expect(isJpeg(buf)).toBe(true);
    expect(isPng(buf)).toBe(false);
    expect(getJpegDimensions(buf)).toEqual({ width: 640, height: 480 });

    const result = validateCircuitImage(buf);
    expect(result.valid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it('rejects oversized bytes (> 4 MiB)', () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const res = validateCircuitImage(huge);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/exceeds 4 MiB limit/);
  });

  it('rejects dimensions exceeding 4096px per side', () => {
    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
    header.set([0x00, 0x00, 0x00, 0x0D], 8);
    header.set([0x49, 0x48, 0x44, 0x52], 12);
    const view = new DataView(header.buffer);
    view.setUint32(16, 5000, false); // 5000 px > 4096
    view.setUint32(20, 100, false);

    const res = validateCircuitImage(header);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/exceed maximum allowed 4096px/);
  });

  it('rejects resolution exceeding 4 megapixels', () => {
    const header = new Uint8Array(24);
    header.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
    header.set([0x00, 0x00, 0x00, 0x0D], 8);
    header.set([0x49, 0x48, 0x44, 0x52], 12);
    const view = new DataView(header.buffer);
    view.setUint32(16, 3000, false); // 3000 x 3000 = 9 MP > 4 MP
    view.setUint32(20, 3000, false);

    const res = validateCircuitImage(header);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/exceeds 4 megapixel limit/);
  });

  it('rejects corrupt headers and non-image files', () => {
    expect(validateCircuitImage(new Uint8Array(0)).valid).toBe(false);
    expect(validateCircuitImage(new Uint8Array([1, 2, 3, 4])).valid).toBe(false);
    expect(validateCircuitImage(new Uint8Array([0x89, 0x50, 0x4E, 0x47])).valid).toBe(false);
  });
});
