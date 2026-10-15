/**
 * Pure zero-dependency synthetic PDF generator for testing OHMI PDF understanding.
 * Generates valid PDF 1.4 documents with arbitrary pages and text lines.
 */

export function createPdf(pages, options = {}) {
  // pages is an array of arrays of text strings, e.g. [["Page 1 Header", "Line 2"], ["Page 2 Header"]]
  // or array of strings (one string per page)
  const normalizedPages = pages.map(p => Array.isArray(p) ? p : [p]);
  const numPages = normalizedPages.length;

  const objects = [];
  let objCount = 0;

  function addObj(body) {
    objCount++;
    objects.push({ num: objCount, body });
    return objCount;
  }

  // 1: Catalog
  const catalogNum = addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2: Pages root (will be updated with kids)
  const pagesRootNum = addObj(null); // placeholder

  // Font object
  const fontNum = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  const pageNums = [];
  for (let i = 0; i < numPages; i++) {
    const pageLines = normalizedPages[i];
    
    // Build content stream with BT / ET and text
    let streamBody = 'BT\n/F1 12 Tf\n';
    let y = 750;
    for (const line of pageLines) {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      streamBody += `50 ${y} Td\n(${escaped}) Tj\n-50 -${y} Td\n`; // reset position
      y -= 20;
    }
    streamBody += 'ET\n';

    // Content stream object
    const streamLen = Buffer.byteLength(streamBody, 'latin1');
    const contentNum = addObj(`<< /Length ${streamLen} >>\nstream\n${streamBody}endstream`);

    // Page object
    const pageObjNum = addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> >>`
    );
    pageNums.push(pageObjNum);
  }

  // Update Pages root (object 2)
  const kidsStr = pageNums.map(n => `${n} 0 R`).join(' ');
  objects[1].body = `<< /Type /Pages /Kids [${kidsStr}] /Count ${numPages} >>`;

  let encryptNum = null;
  if (options.encrypted) {
    encryptNum = addObj(`<< /Filter /Standard /V 1 /R 2 /P -44 /O (dummy-o-password) /U (dummy-u-password) >>`);
  }

  // Assemble file bytes and xref table
  let pdf = '%PDF-1.4\n';
  const offsets = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${obj.num} 0 obj\n${obj.body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objCount + 1} /Root ${catalogNum} 0 R`;
  if (encryptNum) {
    pdf += ` /Encrypt ${encryptNum} 0 R`;
  }
  pdf += ` >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
