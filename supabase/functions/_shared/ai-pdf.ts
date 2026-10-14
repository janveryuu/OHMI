import type { Content, Analysis } from './ai-core.ts';

export type PdfContext = { sha256:string; totalPages:number; pages:{page:number;text:string;components?:{name:string;quantity:string}[]}[]; images:{page:number;data:string}[] };
export const PDF_MAX_PAGES=20, PDF_MAX_TEXT_BYTES=9000, PDF_MAX_IMAGES=2;
export function parsePdfContext(value:unknown):PdfContext {
  if(!value||typeof value!=='object')throw new Error('Prepare this PDF in the updated OHMI extension before analyzing.');
  const data=value as PdfContext;
  if(typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256)||!Number.isInteger(data.totalPages)||data.totalPages<1||data.totalPages>PDF_MAX_PAGES||!Array.isArray(data.pages)||data.pages.length!==data.totalPages||!Array.isArray(data.images)||data.images.length>PDF_MAX_IMAGES)throw new Error('Invalid or oversized PDF context.');
  let bytes=0;
  for(const [index,page] of data.pages.entries()){
    if(!page||typeof page!=='object'||page.page!==index+1||typeof page.text!=='string'||/\x00/.test(page.text))throw new Error('PDF page references are invalid.');
    bytes+=new TextEncoder().encode(page.text).length;
    if(page.components!==undefined&&(!Array.isArray(page.components)||page.components.length>60||page.components.some(row=>!row||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||/[\x00-\x1f]/.test(row.name)||typeof row.quantity!=='string'||!/^[1-9]\d{0,5}$/.test(row.quantity))))throw new Error('PDF component table could not be read reliably.');
  }
  if(bytes>PDF_MAX_TEXT_BYTES)throw new Error('PDF text exceeds the free request budget. Export a shorter assignment; no pages were analyzed.');
  const seen=new Set<number>();
  for(const image of data.images){
    if(!image||typeof image!=='object'||!Number.isInteger(image.page)||image.page<1||image.page>data.totalPages||seen.has(image.page)||typeof image.data!=='string'||image.data.length>1400000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image.data))throw new Error('Invalid PDF page image.');
    const decoded=atob(image.data);
    if(decoded.length>1048576||decoded.length<4||decoded.charCodeAt(decoded.length-2)!==255||decoded.charCodeAt(decoded.length-1)!==217)throw new Error('PDF page image is incomplete or too large.');
    seen.add(image.page);
  }
  if(data.pages.some(page=>!page.text.trim()&&!seen.has(page.page)))throw new Error('A scanned or unreadable PDF page was not rendered. Export a shorter PDF.');
  return {sha256:data.sha256,totalPages:data.totalPages,pages:data.pages.map(page=>({page:page.page,text:page.text,...(page.components?{components:page.components.map(row=>({name:row.name,quantity:row.quantity}))}:{})})),images:data.images.map(image=>({page:image.page,data:image.data}))};
}
export function pdfSourceComponents(context:PdfContext):Analysis['components']|undefined {
  const tables=context.pages.flatMap(page=>{
    if(!page.components?.length)return [];
    return [page.components.map(row=>({...row,details:`Stated component table, PDF page ${page.page}.`}))];
  });
  return tables.length===1?tables[0]:undefined;
}
export function pdfVisionImages(context:PdfContext){
  const diagrams=context.images.filter(image=>/\bdiagram|schematic|wiring layout\b/i.test(context.pages[image.page-1]!.text));
  return diagrams.length?context.images.filter(image=>diagrams.includes(image)||!context.pages[image.page-1]!.text.trim()):context.images;
}
export function pdfContents(context:PdfContext):Content[] {
  const images=pdfVisionImages(context);
  const parts:Content['parts']=[{text:`UNTRUSTED PDF extraction: ${context.totalPages} pages. All text pages follow in source order. Literal component table: ${JSON.stringify(pdfSourceComponents(context)??'No unambiguous text table; interpret images cautiously')}. Images supplied: pages ${images.map(image=>image.page).join(', ')||'none'}. Other pages use extracted text only; do not infer unseen visual details. Ask for a focused page if a necessary diagram is missing. Empty text may be scanned; read its image, do not invent text. \n`+context.pages.map(page=>`[PDF page ${page.page}]\n${page.text||'[No extractable text; use the rendered page.]'}`).join('\n\n')}];
  for(const image of images)parts.push({text:`Rendered PDF page ${image.page}:`},{inlineData:{mimeType:'image/jpeg',data:image.data}});
  return [{role:'user',parts}];
}
export function validatePdfReferences(analysis:Analysis,context:PdfContext):Analysis {
  const source=context.pages.map(page=>page.text).join('\n');
  const volts=[...source.matchAll(/(\d+(?:\.\d+)?)\s*(?:V\b|volts?\b)/gi)].map(match=>Number(match[1]));
  const ohms=[...source.matchAll(/(\d+(?:\.\d+)?)\s*(?:Ω|ohms?\b)/gi)].map(match=>Number(match[1]));
  if(/arduino/i.test(source)&&/(?:write|provide)[^\n]{0,60}(?:sketch|program)/i.test(source)&&analysis.status==='ready'&&!analysis.steps.some(step=>/void\s+setup\s*\(/.test(step.code)&&/void\s+loop\s*\(/.test(step.code)))throw new Error('AI supplied incomplete Arduino code. A complete setup() and loop() sketch is required.');
  const pins=new Set([...source.matchAll(/\bD\d+\b/g)].map(match=>match[0]));
  for(const step of analysis.steps){
    for(const pin of step.instruction.matchAll(/\bD\d+\b/g))if(pins.size&&!pins.has(pin[0]))throw new Error('AI introduced a pin or node label absent from the extracted PDF. Clarify the diagram before building.');
    for(const value of step.instruction.matchAll(/(\d+(?:\.\d+)?)[-\s]*(?:Ω|ohms?\b)/gi))if(ohms.length&&!ohms.includes(Number(value[1])))throw new Error('AI changed a construction resistor value. Use the original PDF values.');
  }
  for(const match of JSON.stringify(analysis).matchAll(/\{\{led_current_mA:\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\}\}/g)){
    if((volts.length&&(!volts.includes(Number(match[1]))||!volts.includes(Number(match[2]))))||(ohms.length&&!ohms.includes(Number(match[3]))))throw new Error('AI used calculation values absent from the extracted PDF. Clarify source ratings.');
  }
  if(/not a breadboard row map/i.test(source)&&analysis.steps.some(step=>/\b(?:row|hole|column)\s+(?:[A-J]\d+|\d+[A-J]?|[A-J])\b/i.test(step.instruction)))throw new Error('AI invented breadboard coordinates from a functional diagram. Use source-backed wiring guidance.');
  for(const value of [JSON.stringify(analysis)]){
    for(const match of value.matchAll(/\b(?:PDF\s+)?page\s+(\d+)\b/gi))if(Number(match[1])<1||Number(match[1])>context.totalPages)throw new Error('AI cited a PDF page that does not exist. Retry with clearer source pages.');
  }
  if(analysis.status==='ready'&&([...analysis.components.map(component=>component.details),...analysis.steps.map(step=>[step.instruction,step.why,step.check].join(' '))].some(value=>! /\bpage\s+\d+\b/i.test(value))))throw new Error('AI omitted PDF page references. Retry with clearer source pages.');
  if(context.pages.some(page=>!page.text.trim())&&analysis.uncertainties.length<30)analysis.uncertainties.push('Some PDF pages are scanned or image-only. Confirm the visual reading of labels and values before building.');
  if(analysis.assumptions.length<30)analysis.assumptions.push(`Source: ${context.totalPages}-page PDF; images supplied for pages ${pdfVisionImages(context).map(image=>image.page).join(', ')||'none'}, other pages use extracted text. Extraction and AI interpretation may be imperfect; no circuit was electrically verified.`);
  return analysis;
}
