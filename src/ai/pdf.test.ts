import { describe, it, expect } from 'vitest';
import { isPdf, isEncryptedPdf, validatePdfDocument, verifyPageCitation, MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_PDF_CHARS } from './pdf.js';
// @ts-expect-error create-pdf.mjs has no declaration file
import { createPdf } from '../../tests/fixtures/create-pdf.mjs';

describe('PDF Document Validation and Citation Verification', () => {
  it('correctly identifies PDF magic bytes', () => {
    expect(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31]))).toBe(true);
    expect(isPdf(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBe(false);
    expect(isPdf(new Uint8Array([0x00, 0x00, 0x00]))).toBe(false);
  });

  it('rejects empty and oversized PDF buffers', async () => {
    const emptyRes = await validatePdfDocument(new Uint8Array(0));
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.error).toContain('Empty file');

    const oversizedBuf = new Uint8Array(MAX_PDF_BYTES + 1);
    oversizedBuf.set([0x25, 0x50, 0x44, 0x46, 0x2D]);
    const sizeRes = await validatePdfDocument(oversizedBuf);
    expect(sizeRes.valid).toBe(false);
    expect(sizeRes.error).toContain('exceeds 2 MiB');
  });

  it('rejects corrupt PDF files', async () => {
    const corruptBuf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x00, 0xFF, 0xEE]);
    const corruptRes = await validatePdfDocument(corruptBuf);
    expect(corruptRes.valid).toBe(false);
    expect(corruptRes.error).toContain('Corrupt or unreadable PDF');
  });

  it('detects and rejects password-encrypted PDFs', async () => {
    const encBytes = createPdf([['Confidential Circuit Specification']], { encrypted: true });
    expect(isEncryptedPdf(encBytes)).toBe(true);

    const encRes = await validatePdfDocument(new Uint8Array(encBytes));
    expect(encRes.valid).toBe(false);
    expect(encRes.error).toContain('Encrypted or password-protected');
  });

  it('accepts valid multi-page PDF and extracts text per page', async () => {
    const validBytes = createPdf([
      ['Lab 1: LED Circuit Experiment', 'Required Components: 1x 220 Ohm resistor, 1x Red LED'],
      ['Page 2: Circuit Assembly', 'Connect anode to Arduino digital pin 13', 'Connect cathode through 220 ohm resistor to GND'],
      ['Page 3: Arduino Code', 'In setup(), configure pin 13 as OUTPUT.', 'In loop(), digitalWrite HIGH, delay 1000, digitalWrite LOW.']
    ]);

    const res = await validatePdfDocument(new Uint8Array(validBytes));
    expect(res.valid).toBe(true);
    expect(res.pages).toBe(3);
    expect(res.textByPage).toHaveLength(3);
    expect(res.textByPage?.[0]).toContain('Lab 1: LED Circuit Experiment');
    expect(res.textByPage?.[1]).toContain('digital pin 13');
    expect(res.textByPage?.[2]).toContain('OUTPUT');
    expect(res.totalChars).toBeGreaterThan(100);
  });

  it('rejects PDFs exceeding 6 pages', async () => {
    const sevenPages = createPdf([
      ['Page 1'], ['Page 2'], ['Page 3'], ['Page 4'], ['Page 5'], ['Page 6'], ['Page 7']
    ]);
    const res = await validatePdfDocument(new Uint8Array(sevenPages));
    expect(res.valid).toBe(false);
    expect(res.error).toContain('exceeds the maximum limit of 6 pages');
  });

  it('verifies valid page citations and rejects fabricated/out-of-bounds citations', () => {
    const textByPage = [
      'Lab 1: LED Circuit Experiment\nRequired: 1x 220 Ohm resistor, 1x Red LED',
      'Page 2: Assembly\nConnect anode to Arduino digital pin 13 with 1000ms blink rate',
      'Page 3: Questions\nWhat is the current flowing through the circuit?'
    ];

    // Valid exact match
    const c1 = verifyPageCitation(textByPage, 1, '220 Ohm resistor');
    expect(c1.verified).toBe(true);

    // Valid normalized match (case & whitespace differences)
    const c2 = verifyPageCitation(textByPage, 2, 'arduino  digital  PIN  13');
    expect(c2.verified).toBe(true);

    // Mismatched page (excerpt is on page 2, not page 1)
    const c3 = verifyPageCitation(textByPage, 1, 'digital pin 13');
    expect(c3.verified).toBe(false);
    expect(c3.details).toContain('not found on page 1');

    // Fabricated excerpt (not in document at all)
    const c4 = verifyPageCitation(textByPage, 3, 'Connect to Raspberry Pi GPIO 4');
    expect(c4.verified).toBe(false);

    // Out-of-bounds page
    const c5 = verifyPageCitation(textByPage, 5, 'Any text');
    expect(c5.verified).toBe(false);
    expect(c5.details).toContain('out of bounds');
  });
});
