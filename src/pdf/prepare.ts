import {getDocument, GlobalWorkerOptions, OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractComponentTable} from './table';
import {PDF_MAX_PAGES,PDF_MAX_TEXT_BYTES,PDF_MAX_IMAGES,parsePdfContext,type PdfContext} from '../../supabase/functions/_shared/ai-pdf';

export async function preparePdf(bytes:Uint8Array,assetUrl:string):Promise<PdfContext> {
  if(bytes.length>10485760||![37,80,68,70,45].every((byte,index)=>bytes[index]===byte))throw new Error('Invalid PDF or file larger than 10 MiB.');
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  GlobalWorkerOptions.workerSrc=assetUrl+'pdf.worker.min.mjs';
  const task=getDocument({data:bytes,cMapUrl:assetUrl+'cmaps/',cMapPacked:true,standardFontDataUrl:assetUrl+'standard_fonts/',useWasm:false,stopAtErrors:true});
  try{
    const pdf=await task.promise;
    if(pdf.numPages>PDF_MAX_PAGES)throw new Error('PDF exceeds 20 pages. Export the relevant assignment pages first.');
    const result:PdfContext={sha256,totalPages:pdf.numPages,pages:[],images:[]};let textBytes=0;
    const graphical=new Set([OPS.constructPath,OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject,OPS.paintImageXObjectRepeat,OPS.paintImageMaskXObjectRepeat,OPS.shadingFill]);
    for(let number=1;number<=pdf.numPages;number++){
      const page=await pdf.getPage(number);const content=await page.getTextContent();
      const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('');
      textBytes+=new TextEncoder().encode(text).length;
      if(textBytes>PDF_MAX_TEXT_BYTES)throw new Error('PDF text exceeds the free request budget. Export a shorter assignment; no pages were analyzed.');
      const components=extractComponentTable(content.items.filter(item=>'str' in item));
      result.pages.push({page:number,text,...(components?{components}:{})});
      const operators=await page.getOperatorList();
      if(!text.trim()||operators.fnArray.some(operator=>graphical.has(operator))){
        if(result.images.length>=PDF_MAX_IMAGES)throw new Error('PDF has more than two graphical/scanned pages. Export up to two relevant visual pages with their instructions; no pages were analyzed.');
        const base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2.5,2000/Math.max(base.width,base.height))});
        if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<1||viewport.height<1)throw new Error('PDF page dimensions could not be read.');
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        try{
          await page.render({canvas,viewport,background:'rgb(255,255,255)'}).promise;
          const data=canvas.toDataURL('image/jpeg',0.92).split(',')[1]!;
          result.images.push({page:number,data});
        }finally{canvas.width=canvas.height=0;}
      }
      page.cleanup();
    }
    return parsePdfContext(result);
  }catch(error){
    if(error instanceof Error&&/^(PDF (exceeds|text|has|page)|Invalid PDF|A scanned)/.test(error.message))throw error;
    throw new Error('PDF could not be extracted or rendered. It may be locked, damaged or use an unsupported encoding. Export an unlocked PDF or upload clear page images.');
  }finally{await task.destroy();}
}
