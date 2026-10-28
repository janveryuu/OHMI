import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConversationPage } from '../src/lib/backend/data.ts';
const messages=(start,end)=>Array.from({length:end-start+1},(_,i)=>({id:String(i+start),position:i+start,role:'assistant',text:'Saved '+(i+start)}));
test('a refreshed page retains already loaded contiguous history without duplicates',()=>{
 const result=mergeConversationPage({id:'chat',title:'Chat',loaded:true,hasOlder:false,messages:messages(1,60)},{loaded:true,hasOlder:true,messages:messages(13,62)});
 assert.equal(result.messages.length,62);assert.equal(result.messages[0].position,1);assert.equal(result.hasOlder,false);
});
test('a remote-device gap uses contiguous latest page so missing middle can still be paged',()=>{
 const result=mergeConversationPage({id:'chat',title:'Chat',loaded:true,hasOlder:false,messages:messages(1,10)},{loaded:true,hasOlder:true,messages:messages(61,110)});
 assert.equal(result.messages.length,50);assert.equal(result.messages[0].position,61);assert.equal(result.hasOlder,true);
});
