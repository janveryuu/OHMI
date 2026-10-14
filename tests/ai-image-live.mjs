import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {testAiExtension} from './ai-extension.mjs';
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
assert.equal(env.WXT_SUPABASE_URL,'https://vhmdgfydvoljzqztuxmu.supabase.co');
const folder='.superpowers/sdd/2026-10-12-phase-3';const files=(await readdir(folder)).filter(name=>/^live-fixture-.*\.json$/.test(name));assert.equal(files.length,1);
const fixtures=JSON.parse(await readFile(`${folder}/${files[0]}`,'utf8'));const clients=[];const check=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
for(const fixture of fixtures){const client=createClient(env.WXT_SUPABASE_URL,env.WXT_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await client.auth.signInWithPassword({email:fixture.email,password:fixture.password}));clients.push(client);}
const [a,b]=clients;const bytes=await readFile('tests/fixtures/phase-4/led-lab.png');const id=crypto.randomUUID();const path=`${fixtures[0].id}/${id}/assignment.png`;
try{
 check(await a.from('ohmi_assignments').insert({id,user_id:fixtures[0].id,original_name:'led-lab.png',object_path:path,mime_type:'image/png',size_bytes:bytes.length}));check(await a.storage.from('ohmi-assignments').upload(path,bytes,{contentType:'image/png'}));check(await a.from('ohmi_assignments').update({status:'ready'}).eq('id',id));
 const input={kind:'analyze',accountId:fixtures[0].id,requestId:crypto.randomUUID(),assignmentId:id};
 assert.equal(check(await b.functions.invoke('ohmi-ai',{body:{...input,accountId:fixtures[1].id}})).ok,false);
 const result=check(await a.functions.invoke('ohmi-ai',{body:input}));assert.equal(result.ok,true,result.error);assert.equal(result.data.payload.status,'ready');assert.match(JSON.stringify(result.data.payload),/220/);
 await writeFile('.superpowers/sdd/2026-10-14-phase-4/image-edge-results.json',JSON.stringify(result.data,null,2));
 const before=check(await a.from('ohmi_ai_requests').select('id')).length;const cached=check(await a.functions.invoke('ohmi-ai',{body:{...input,requestId:crypto.randomUUID()}}));assert.equal(cached.ok,true);assert.equal(cached.cached,true);assert.equal(cached.data.id,result.data.id);assert.equal(check(await a.from('ohmi_ai_requests').select('id')).length,before);
 check(await a.rpc('ohmi_save_tutorial_progress',{p_analysis_id:result.data.id,p_current_step:1,p_completed:[0]}));assert.equal(check(await b.from('ohmi_analyses').select('id')).length,0);
 const conversation=check(await a.from('ohmi_conversations').insert({user_id:fixtures[0].id}).select().single());
 await testAiExtension(fixtures,{analysisId:result.data.id,conversationId:conversation.id,assignmentName:'led-lab.png',hasCode:false});
 console.log(`PASS live ${result.data.model} private image analysis, free cache, saved tutor/progress, UI and two-user isolation.`);
}finally{check(await a.storage.from('ohmi-assignments').remove([path]));check(await a.from('ohmi_assignments').delete().eq('id',id));check(await a.from('ohmi_conversations').delete().eq('user_id',fixtures[0].id));}
