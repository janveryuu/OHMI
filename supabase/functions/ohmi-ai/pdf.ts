// @ts-ignore
import { extractText } from 'npm:unpdf@1.8.1';

export const MAX_PDF_BYTES = 2 * 1024 * 1024; // 2 MiB limit
export const MAX_PDF_PAGES = 6;                // Up to 6 pages
export const MAX_PDF_CHARS = 24_000;           // Up to 24,000 characters

export function isPdf(buf: Uint8Array): boolean {
  return buf.length >= 5 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2D;
}

export function isEncryptedPdf(buf: Uint8Array): boolean {
  // Pre-check for /Encrypt dictionary in PDF cross-reference / trailer
  const str = new TextDecoder('latin1').decode(buf);
  return /\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<<|\/Encrypt\b/i.test(str);
}

export interface PdfValidationResult {
  valid: boolean;
  pages?: number;
  textByPage?: string[];
  totalChars?: number;
  error?: string;
}

export async function validatePdfDocument(buf: Uint8Array): Promise<PdfValidationResult> {
  if (!buf || buf.length === 0) {
    return { valid: false, error: 'Empty file provided' };
  }
  if (buf.length > MAX_PDF_BYTES) {
    return { valid: false, error: `PDF size ${buf.length} bytes exceeds 2 MiB limit` };
  }
  if (!isPdf(buf)) {
    return { valid: false, error: 'File is not a valid PDF document' };
  }
  if (isEncryptedPdf(buf)) {
    return { valid: false, error: 'Encrypted or password-protected PDFs are not supported' };
  }

  try {
    const extracted = await extractText(buf, { mergePages: false });
    const pages = extracted.totalPages;
    if (pages > MAX_PDF_PAGES) {
      return { valid: false, error: `PDF has ${pages} pages, which exceeds the maximum limit of ${MAX_PDF_PAGES} pages` };
    }
    const textByPage = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const totalChars = textByPage.reduce((acc: number, t: string) => acc + (t ? t.length : 0), 0);
    if (totalChars > MAX_PDF_CHARS) {
      return { valid: false, error: `PDF text length (${totalChars.toLocaleString()} characters) exceeds ${MAX_PDF_CHARS.toLocaleString()} character limit` };
    }
    return {
      valid: true,
      pages,
      textByPage,
      totalChars
    };
  } catch (err: any) {
    const msg = err?.message || 'Failed to parse PDF document';
    if (/password/i.test(msg) || /encrypt/i.test(msg) || err?.name === 'PasswordException') {
      return { valid: false, error: 'Encrypted or password-protected PDFs are not supported' };
    }
    return { valid: false, error: `Corrupt or unreadable PDF: ${msg}` };
  }
}

export function verifyPageCitation(
  textByPage: string[],
  pageNumber: number,
  excerpt: string
): { verified: boolean; normalizedMatch: boolean; details?: string } {
  if (pageNumber < 1 || pageNumber > textByPage.length) {
    return { verified: false, normalizedMatch: false, details: `Page ${pageNumber} is out of bounds (1..${textByPage.length})` };
  }
  const pageText = textByPage[pageNumber - 1] || '';
  if (!excerpt || !excerpt.trim()) {
    return { verified: false, normalizedMatch: false, details: 'Empty excerpt' };
  }

  if (pageText.includes(excerpt)) {
    return { verified: true, normalizedMatch: true };
  }

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const normPage = normalize(pageText);
  const normExcerpt = normalize(excerpt);

  if (normPage.includes(normExcerpt)) {
    return { verified: true, normalizedMatch: true };
  }

  return {
    verified: false,
    normalizedMatch: false,
    details: `Excerpt not found on page ${pageNumber}`
  };
}
