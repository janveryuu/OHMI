import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {chromium} from 'playwright';

const output=resolve('.local-tests/phase4-pdf');await mkdir(output,{recursive:true});
const source=process.env.OHMI_PDF_ASSIGNMENT_PATH;assert.ok(source,'Set OHMI_PDF_ASSIGNMENT_PATH');
const bytes=await readFile(source);const profile=await mkdtemp(join(tmpdir(),'ohmi-pdf-'));let context;
try{
  context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.OHMI_CHROMIUM_PATH,args:[`--disable-extensions-except=${resolve('.output/chrome-mv3')}`,`--load-extension=${resolve('.output/chrome-mv3')}`]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const cases=process.env.OHMI_PDF_VARIANTS==='1'?['scanned','too-many','broken']:['real'];
  for(const name of cases){
    const input=name==='real'?bytes:await readFile(join(output,name+'.pdf'));
    const result=await worker.evaluate(async data=>{
    await Promise.race([chrome.offscreen.createDocument({url:'pdf.html',reasons:['WORKERS','BLOBS'],justification:'Test private PDF extraction.'}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offscreen creation did not finish')),15000))]);
    try{return await Promise.race([chrome.runtime.sendMessage({channel:'ohmi.pdf',data}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('PDF renderer did not reply')),30000))]);}finally{await chrome.offscreen.closeDocument();}
  },input.toString('base64'));
  if(name==='too-many'||name==='broken'){assert.equal(result?.ok,false);assert.match(result.error,name==='too-many'?/more than two/:/could not be extracted|Invalid PDF/);console.log(`PASS ${name} PDF fails clearly without partial analysis.`);continue;}
  assert.equal(result?.ok,true,result?.error);assert.equal(result.data.totalPages,2);
  assert.deepEqual(result.data.pages.map(page=>page.page),[1,2]);assert.equal(result.data.images.length,2);
  if(name==='scanned'){assert.ok(result.data.pages.every(page=>!page.text.trim()));console.log('PASS two-page scanned PDF: both page images retained, text absence explicit.');continue;}
  const text=result.data.pages.map(page=>page.text).join(' ');assert.match(text,/220/);assert.match(text,/D9/);assert.match(text,/Jumper wires/);assert.match(text,/functional diagram/);
  await writeFile(join(output,'pdf-context.json'),JSON.stringify(result.data));
  for(const image of result.data.images)await writeFile(join(output,`page-${image.page}.jpg`),Buffer.from(image.data,'base64'));
  }
  console.log('PASS selected PDF extraction checks; no AI requests.');
}finally{await context?.close();assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('ohmi-pdf-'));await rm(profile,{recursive:true,force:true});}
