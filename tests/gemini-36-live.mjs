import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {testAiExtension} from './ai-extension.mjs';

export async function testGemini36Live(env,clients,fixtures){
  const check=result=>{assert.equal(result.error,null,result.error?.message);return result.data;};
  const [a,b]=clients;const owner=fixtures[0].id;
  const output='.local-tests/gemini-36';await mkdir(output,{recursive:true});
  const pdfPath=process.env.OHMI_PDF_ASSIGNMENT_PATH;assert.ok(pdfPath,'Select the existing Arduino LED Blink PDF');
  const pdf=await readFile(pdfPath);const pdfContext=JSON.parse(await readFile('.local-tests/phase4-pdf/pdf-context.json','utf8'));
  assert.equal(pdfContext.sha256,createHash('sha256').update(pdf).digest('hex'),'Context must match the original PDF');
  const imagePath=process.env.OHMI_GEMINI_IMAGE_PATH??'tests/fixtures/phase-4/led-lab.png';
  const image=await readFile(imagePath);const mime=/\.jpe?g$/i.test(imagePath)?'image/jpeg':'image/png';
  for(let i=0;i<2;i++)check(await clients[i].from('ohmi_profiles').insert({id:fixtures[i].id,language:'english'}));
  const conversation=check(await a.from('ohmi_conversations').insert({user_id:owner}).select().single());
  const message='For an Arduino Uno LED blink lesson: D9 HIGH is 5 V, red LED drop is 2 V, resistor is 220 ohms. Explain the resistor and anode/cathode series connections. Show the estimated ON current calculation with mA units. Give a complete untested Arduino setup()/loop() sketch: D9 output, 1000 ms HIGH then 1000 ms LOW. Explain the blink period/frequency and ask one short tutoring question. Keep concise.';
  const uploads=[];const records=[];let pdfAnalysis;let blocked=false;
  const verifyText=text=>{
    assert.match(text,/13[.,]6\d*\s*mA|0[.,]0136\d*\s*A/i);
    assert.match(text,/void\s+setup\s*\(/);assert.match(text,/void\s+loop\s*\(/);
    assert.match(text,/HIGH/);assert.match(text,/LOW/);assert.match(text,/1000/);
    assert.match(text,/anode/i);assert.match(text,/cathode/i);assert.match(text,/220/);
    assert.doesNotMatch(text,/(?<![\d.])1\s*Hz|\b9\s*mA|\b16[.,]8\s*mA/);
  };
  try{
    for(const name of ['text','image','pdf']){
      if(blocked){records.push({case:name,ok:false,skipped:'Gemini quota unavailable; no retry or fallback'});continue;}
      const requestId=crypto.randomUUID();let body;
      if(name==='text')body={kind:'chat',accountId:owner,requestId,conversationId:conversation.id,message};
      else{
        const id=crypto.randomUUID();const bytes=name==='pdf'?pdf:image;const type=name==='pdf'?'application/pdf':mime;
        const path=`${owner}/${id}/assignment.${name==='pdf'?'pdf':type==='image/jpeg'?'jpg':'png'}`;
        uploads.push({id,path});
        check(await a.from('ohmi_assignments').insert({id,user_id:owner,original_name:name==='pdf'?'Arduino LED Blink assignment.pdf':'LED reference circuit diagram',object_path:path,mime_type:type,size_bytes:bytes.length}));
        check(await a.storage.from('ohmi-assignments').upload(path,bytes,{contentType:type}));
        check(await a.from('ohmi_assignments').update({status:'ready'}).eq('id',id));
        body={kind:'analyze',accountId:owner,requestId,assignmentId:id,...(name==='pdf'?{pdfContext}:{})};
      }
      const response=await a.functions.invoke('ohmi-ai',{body,signal:AbortSignal.timeout(110000)});
      const result=response.data;const record={case:name,ok:false};records.push(record);
      await writeFile(`${output}/${name}-response.json`,JSON.stringify(result??{error:response.error?.message},null,2));
      if(response.error||!result?.ok){record.error=response.error?.message??result?.error;blocked=/HTTP 429|quota.*(?:exhausted|unavailable)/i.test(record.error);console.log(JSON.stringify(record));continue;}
      const usage=check(await a.from('ohmi_ai_requests').select('model,status,input_tokens,output_tokens').eq('id',requestId).single());
      Object.assign(record,usage);assert.equal(usage.model,'gemini-3.6-flash');assert.equal(usage.status,'completed');assert.ok(usage.input_tokens>0&&usage.output_tokens>0);
      try{
        if(name==='text'){verifyText(result.data.content);assert.match(result.data.content,/untested|not.*test/i);}
        else{
          const guide=result.data.payload;assert.equal(guide.status,'ready');assert.ok(guide.steps.length>=3);
          const text=JSON.stringify(guide);assert.match(text,/13[.,]6\d*\s*mA|0[.,]0136\d*\s*A/i);assert.match(text,/anode/i);assert.match(text,/cathode/i);assert.match(text,/GND/);assert.match(text,/220/);
          assert.doesNotMatch(text,/(?<![\d.])1\s*Hz|\b9\s*mA|\b16[.,]8\s*mA|external battery is required|600.pin/);
          for(const namePattern of [/arduino|uno/i,/\bled\b/i,/resistor/i]){const component=guide.components.find(row=>namePattern.test(row.name));assert.ok(component,`Missing ${namePattern}`);assert.match(component.quantity,/^(1|one)(\b|$)/i);}
          if(name==='pdf'){
            const board=guide.components.find(row=>/breadboard/i.test(row.name));assert.equal(board?.quantity,'1');
            const wires=guide.components.find(row=>/jumper|wires/i.test(row.name));assert.equal(wires?.quantity,'2');
            verifyText(guide.steps.map(step=>step.code+' '+step.instruction+' '+step.why).join('\n')+' '+guide.expectedResults.join(' '));
            assert.ok(guide.components.every(row=>/page\s+[12]/i.test(row.details)));pdfAnalysis=result.data;
          }
        }
        record.ok=true;
      }catch(error){record.error=`Technical acceptance: ${error.message}`;}
      console.log(JSON.stringify(record));
    }
    await writeFile(`${output}/results.json`,JSON.stringify(records,null,2));
    assert.ok(records.every(record=>record.ok),'All three real Gemini cases must pass before saved-progress verification');
    const before=check(await a.from('ohmi_ai_requests').select('id')).length;
    const cached=check(await a.functions.invoke('ohmi-ai',{body:{kind:'analyze',accountId:owner,requestId:crypto.randomUUID(),assignmentId:pdfAnalysis.assignment_id}}));
    assert.equal(cached.ok,true);assert.equal(cached.cached,true);assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before);
    check(await a.rpc('ohmi_save_tutorial_progress',{p_analysis_id:pdfAnalysis.id,p_current_step:0,p_completed:[]}));
    assert.equal(check(await b.from('ohmi_analyses').select('id')).length,0);
    await testAiExtension(fixtures,{analysisId:pdfAnalysis.id,conversationId:conversation.id,hasCode:true});
    const progress=check(await a.from('ohmi_tutorial_progress').select('completed').eq('analysis_id',pdfAnalysis.id).single());assert.deepEqual(progress.completed,[0]);
    const contextual=check(await a.from('ohmi_conversations').insert({user_id:owner,analysis_id:pdfAnalysis.id}).select().single());
    const followup=check(await a.functions.invoke('ohmi-ai',{body:{kind:'chat',accountId:owner,requestId:crypto.randomUUID(),conversationId:contextual.id,stepIndex:0,message:'Why is the resistor in series, and what estimated LED ON current do the assignment values imply? Two sentences.'}}));
    await writeFile(`${output}/followup.json`,JSON.stringify(followup,null,2));assert.equal(followup.ok,true,followup.error);assert.match(followup.data.content,/13[.,]6\d*\s*mA/i);
    assert.equal(check(await b.from('ohmi_messages').select('id').eq('conversation_id',contextual.id)).length,0);
    console.log('PASS real Gemini PDF cache, tutorial progress after browser reload, current-step follow-up and two-user isolation.');
  }finally{
    await writeFile(`${output}/results.json`,JSON.stringify(records,null,2));
    for(const {id,path} of uploads){check(await a.storage.from('ohmi-assignments').remove([path]));check(await a.from('ohmi_assignments').delete().eq('id',id));}
    check(await a.from('ohmi_conversations').delete().eq('user_id',owner));
  }
}
