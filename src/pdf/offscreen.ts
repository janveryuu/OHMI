import {browser} from 'wxt/browser';
import {parsePdfContext,type PdfContext} from '../../supabase/functions/_shared/ai-pdf';
let active=false;
export async function renderPrivatePdf(bytes:Uint8Array):Promise<PdfContext> {
  if(active)throw new Error('A PDF is being prepared. Retry shortly.');
  active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const url=browser.runtime.getURL('/pdf.html');
    if(!(await browser.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]})).length)await browser.offscreen.createDocument({url:'pdf.html',reasons:['WORKERS','BLOBS'],justification:'Extract and render private PDF assignments locally without touching the Tinkercad page.'});
    let data='';for(let offset=0;offset<bytes.length;offset+=8192)data+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    const reply=await Promise.race([browser.runtime.sendMessage({channel:'ohmi.pdf',data:btoa(data)}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('PDF preparation timed out. Export fewer pages and retry.')),60000);})]);
    if(!reply?.ok)throw new Error(reply?.error??'PDF preparation failed. Reload OHMI and retry.');
    return parsePdfContext(reply.data);
  }finally{clearTimeout(timer);await browser.offscreen.closeDocument().catch(()=>undefined);active=false;}
}
