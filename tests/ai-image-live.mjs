import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {testAiExtension} from './ai-extension.mjs';
import {verifyTutorFixture} from './saved-tutor-live.mjs';
export async function testAssignmentLive(env,clients,fixtures){
assert.equal(env.WXT_SUPABASE_URL,'https://vhmdgfydvoljzqztuxmu.supabase.co');
const ext=process.env.OHMI_AI_FILE_TYPE;assert.ok(['pdf','png','jpg'].includes(ext),'Choose one assignment file type');
const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg'}[ext];
const check=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
const [a,b]=clients;for(let i=0;i<2;i++)check(await clients[i].from('ohmi_profiles').insert({id:fixtures[i].id,language:'english'}));
const bytes=await readFile(`tests/fixtures/phase-4/led-lab.${ext}`);const id=crypto.randomUUID();const path=`${fixtures[0].id}/${id}/assignment.${ext}`;
try{
 check(await a.from('ohmi_assignments').insert({id,user_id:fixtures[0].id,original_name:`led-lab.${ext}`,object_path:path,mime_type:mime,size_bytes:bytes.length}));check(await a.storage.from('ohmi-assignments').upload(path,bytes,{contentType:mime}));check(await a.from('ohmi_assignments').update({status:'ready'}).eq('id',id));
 const input={kind:'analyze',accountId:fixtures[0].id,requestId:crypto.randomUUID(),assignmentId:id};
 assert.equal(check(await b.functions.invoke('ohmi-ai',{body:{...input,accountId:fixtures[1].id}})).ok,false);
 const result=check(await a.functions.invoke('ohmi-ai',{body:input}));assert.equal(result.ok,true,result.error);assert.equal(result.data.payload.status,'ready');assert.match(JSON.stringify(result.data.payload),/220/);
 const payload=result.data.payload;
 verifyTutorFixture(payload);
 await writeFile(`.superpowers/sdd/2026-10-14-phase-4/${ext}-edge-results.json`,JSON.stringify(result.data,null,2));
 const before=check(await a.from('ohmi_ai_requests').select('id')).length;const cached=check(await a.functions.invoke('ohmi-ai',{body:{...input,requestId:crypto.randomUUID()}}));assert.equal(cached.ok,true);assert.equal(cached.cached,true);assert.equal(cached.data.id,result.data.id);assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before);
 const step=Math.min(1,payload.steps.length-1);check(await a.rpc('ohmi_save_tutorial_progress',{p_analysis_id:result.data.id,p_current_step:step,p_completed:[0]}));
 const progress=check(await a.from('ohmi_tutorial_progress').select('current_step,completed').eq('analysis_id',result.data.id).single());assert.equal(progress.current_step,step);assert.deepEqual(progress.completed,[0]);assert.equal(check(await b.from('ohmi_analyses').select('id')).length,0);
 const conversation=check(await a.from('ohmi_conversations').insert({user_id:fixtures[0].id}).select().single());
 if(process.env.OHMI_AI_UI==='1')await testAiExtension(fixtures,{analysisId:result.data.id,conversationId:conversation.id,assignmentName:`led-lab.${ext}`,hasCode:false});
 console.log(`PASS live ${result.data.model} private ${ext} analysis, quantities/current, free cache, saved tutor/progress and two-user isolation.`);
 if(process.env.OHMI_AI_LANGUAGES==='1'){
   const contextual=check(await a.from('ohmi_conversations').insert({user_id:fixtures[0].id,analysis_id:result.data.id}).select().single());const explanations=[];
   for(const language of ['filipino','taglish']){
     check(await a.from('ohmi_profiles').update({language}).eq('id',fixtures[0].id));
     const answer=check(await a.functions.invoke('ohmi-ai',{body:{kind:'chat',accountId:fixtures[0].id,requestId:crypto.randomUUID(),conversationId:contextual.id,stepIndex:step,message:'Ipaliwanag ang current step at bakit mahalaga ito. Give a small hint, without completing the assignment. Keep it to two sentences.'}}));assert.equal(answer.ok,true,answer.error);assert.match(answer.data.content,/\b(ang|ng|ito|para|kuryente|natin|yung|mo|kung)\b/i);
     explanations.push({language,answer:answer.data.content});console.log(`PASS live ${language} current-step explanation.`);
   }
   await writeFile(`.superpowers/sdd/2026-10-14-phase-4/${ext}-languages.json`,JSON.stringify(explanations,null,2));check(await a.from('ohmi_profiles').update({language:'english'}).eq('id',fixtures[0].id));
 }

}finally{check(await a.storage.from('ohmi-assignments').remove([path]));check(await a.from('ohmi_assignments').delete().eq('id',id));check(await a.from('ohmi_conversations').delete().eq('user_id',fixtures[0].id));}
}
