import {expect,it} from 'vitest';
import {parsePdfContext,pdfContents,pdfVisionImages,pdfSourceComponents,validatePdfReferences} from '../../supabase/functions/_shared/ai-pdf';
import {parseAiRequest,parseAnalysis} from '../../supabase/functions/_shared/ai-core';
import {generateWithFallback} from '../../supabase/functions/_shared/ai-providers';
const context={sha256:'a'.repeat(64),totalPages:2,pages:[{page:1,text:'Use one Arduino Uno, one 220 ohm resistor, two wires.'},{page:2,text:'D9 -> resistor -> LED anode; cathode -> GND. 5V, 2V.'}],images:[]};
it('selects labelled circuit diagrams while retaining scans and all extracted page text',()=>{
  const images=[{page:1,data:'/9j/2Q=='},{page:2,data:'/9j/2Q=='}];
  const source={...context,pages:[context.pages[0]!,{page:2,text:'Connection diagram: D9 -> resistor -> LED -> GND.'}],images};
  expect(pdfVisionImages(source).map(image=>image.page)).toEqual([2]);
  expect(JSON.stringify(pdfContents(source))).toContain('two wires');
  expect(JSON.stringify(pdfContents(source))).toContain('Other pages use extracted text only');
  expect(pdfVisionImages({...source,pages:[{page:1,text:''},source.pages[1]!]}).map(image=>image.page)).toEqual([1,2]);
  expect(pdfVisionImages({...source,pages:context.pages})).toEqual(images);
});
it('preserves ordered PDF text and source page labels without raw PDF parts',()=>{
  expect(parsePdfContext(context)).toEqual(context);
  const content=pdfContents(context);expect(JSON.stringify(content)).toContain('[PDF page 2]');expect(JSON.stringify(content)).toContain('two wires');expect(JSON.stringify(content)).not.toContain('application/pdf');
});
it('rejects missing scans, omitted pages, oversized text and forged image payloads',()=>{
  for(const value of [{...context,pages:context.pages.slice(0,1)},{...context,pages:[context.pages[0],{page:2,text:''}]},{...context,pages:[{page:1,text:'x'.repeat(9001)},context.pages[1]]},{...context,images:[{page:3,data:'/9j/2Q=='}]},{...context,images:[{page:1,data:'https://example.test/image.jpg'}]}])expect(()=>parsePdfContext(value)).toThrow();
});
it('restricts PDF context to bounded authenticated analysis input',()=>{
  const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  expect(parseAiRequest({kind:'analyze',accountId:id,requestId:id,assignmentId:id,pdfContext:context}).pdfContext).toEqual(context);
  expect(()=>parseAiRequest({kind:'chat',accountId:id,requestId:id,conversationId:id,message:'hi',pdfContext:context})).toThrow();
});
it('never calls either Gemini model for prepared PDF analysis, even after a Groq failure',async()=>{
  const keys={gemini:'test',groq:'test',geminiFree:false,groqFree:true};const calls:string[]=[];
  const input={contents:pdfContents(context),language:'english',analysis:true};
  await expect(generateWithFallback(keys,input,async url=>{calls.push(String(url));return Response.json({},{status:503});},{groqOnly:true})).rejects.toThrow('503');
  expect(calls).toEqual(['https://api.groq.com/openai/v1/chat/completions']);
  await expect(generateWithFallback(keys,input,async()=>{throw new Error('Must not call');},{groqOnly:true,backoffs:{'qwen/qwen3.8-27b':new Date(Date.now()+60000).toISOString()}})).rejects.toThrow(/quota.*Reset/);
});
it('requires real page citations and preserves explicit uncertainty without construction steps',()=>{
  const payload={title:'LED',status:'ready',summary:'Source page 1',objectives:[],components:[{name:'resistor',quantity:'1',details:'220 ohms, PDF page 1'}],expectedResults:[],assumptions:[],uncertainties:[],steps:[{title:'Wire',instruction:'Follow PDF page 2.',why:'Series circuit.',check:'Check polarity',code:''}]};
  expect(validatePdfReferences(parseAnalysis(payload),context).assumptions.join(' ')).toContain('no circuit was electrically verified');
  expect(()=>validatePdfReferences(parseAnalysis({...payload,summary:'See page 3'}),context)).toThrow();
  expect(()=>validatePdfReferences(parseAnalysis({...payload,steps:[{...payload.steps[0],instruction:'Guess a row.'}]}),context)).toThrow();
  expect(validatePdfReferences(parseAnalysis({...payload,status:'needs_clarification',uncertainties:['Unreadable pin label on PDF page 2'],steps:[]}),context).steps).toEqual([]);
});
it('extracts exact source table counts and checks calculation inputs and unsupported row coordinates',()=>{
  const source={...context,pages:[{page:1,text:'QTY COMPONENT\n1 Arduino Uno R3\n1 220 Ω resistor\n2 Jumper wires\n3\nGiven: 5.0 V and 2.0 V.',components:[{name:'Arduino Uno R3',quantity:'1'},{name:'220 Ω resistor',quantity:'1'},{name:'Jumper wires',quantity:'2'}]},{page:2,text:'This is not a breadboard row map.'}]};
  const payload={title:'Lab',status:'ready',summary:'PDF page 1',objectives:[],components:[{name:'Arduino Uno',quantity:'1',details:'PDF page 1'},{name:'220 ohm resistor',quantity:'1',details:'PDF page 1'},{name:'Jumper wires',quantity:'2',details:'PDF page 1'}],expectedResults:['Current {{led_current_mA:5,2,220}}'],assumptions:[],uncertainties:[],steps:[{title:'Wire',instruction:'Follow the functional path on PDF page 2.',why:'Limit current',check:'Check polarity',code:''}]};
  expect(validatePdfReferences(parseAnalysis(payload),source).status).toBe('ready');
  expect(pdfSourceComponents(source)?.map(component=>[component.name,component.quantity])).toEqual([['Arduino Uno R3','1'],['220 Ω resistor','1'],['Jumper wires','2']]);
  expect(pdfSourceComponents(context)).toBeUndefined();
  expect(()=>validatePdfReferences(parseAnalysis({...payload,expectedResults:['{{led_current_mA:9,2,220}}']}),source)).toThrow(/values/);
  expect(()=>validatePdfReferences(parseAnalysis({...payload,steps:[{...payload.steps[0],instruction:'Use row 5 on PDF page 2.'}]}),source)).toThrow(/coordinates/);

});

it('rejects corrupt generated units and unsupported source node labels',()=>{
  const payload={title:'Lab',status:'ready',summary:'PDF page 1',objectives:[],components:[],expectedResults:[],assumptions:[],uncertainties:[],steps:[{title:'Wire',instruction:'Use D1 on PDF page 2.',why:'Series',check:'Polarity',code:''}]};
  expect(()=>validatePdfReferences(parseAnalysis(payload),context)).toThrow(/pin or node/);
  expect(()=>parseAnalysis({...payload,summary:'220\u000b resistor'})).toThrow();
});
it('requires a complete sketch when the source explicitly asks students to write Arduino code',()=>{
  const source={...context,pages:[{page:1,text:'Arduino: Write the Arduino sketch.'},context.pages[1]!]};
  const payload={title:'Lab',status:'ready',summary:'PDF page 1',objectives:[],components:[],expectedResults:[],assumptions:[],uncertainties:[],steps:[{title:'Program',instruction:'Program D9 on PDF page 2.',why:'Blink',check:'Observe',code:'pinMode(9, OUTPUT);'}]};
  expect(()=>validatePdfReferences(parseAnalysis(payload),source)).toThrow(/incomplete Arduino/);
  expect(validatePdfReferences(parseAnalysis({...payload,steps:[{...payload.steps[0],code:'void setup() { pinMode(9, OUTPUT); }\nvoid loop() { digitalWrite(9, HIGH); delay(1000); digitalWrite(9, LOW); delay(1000); }'}]}),source).status).toBe('ready');
});
