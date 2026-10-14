import {browser} from 'wxt/browser';
import {preparePdf} from '../../src/pdf/prepare';
// Offscreen documents have no display frames; PDF.js rendering must still advance.
window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),0);
window.cancelAnimationFrame=id=>window.clearTimeout(id);
let busy=false;
browser.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.channel!=='ohmi.pdf'||sender.id!==browser.runtime.id||sender.tab||sender.url!==browser.runtime.getURL('/background.js'))return;
  void(async()=>{
    if(busy){respond({ok:false,error:'A PDF is being prepared. Retry shortly.'});return;}
    busy=true;
    try{
      if(typeof message.data!=='string'||message.data.length>14000000)throw new Error('Invalid PDF processing request.');
      const bytes=Uint8Array.from(atob(message.data),character=>character.charCodeAt(0));
      respond({ok:true,data:await preparePdf(bytes,new URL('assets/pdf/',browser.runtime.getURL('/pdf.html')).href)});
    }catch(error){respond({ok:false,error:error instanceof Error?error.message:'PDF preparation failed. Export a shorter unlocked PDF or clear page images.'});}
    finally{busy=false;}
  })();return true;
});
