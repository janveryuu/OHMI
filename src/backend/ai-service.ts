import {renderPrivatePdf} from '../pdf/offscreen';
import type { SupabaseClient } from '@supabase/supabase-js';
import { browser } from 'wxt/browser';
import type { Database } from './database.types';
import type { Request } from './validation';
import { parseAiRequest, parseAnalysis } from '../../supabase/functions/_shared/ai-core';

const check = <T>(result: { data: T; error: unknown }) => { if (result.error) throw result.error; return result.data; };
export async function handleAi(client: SupabaseClient<Database>, userId: string, request: Request) {
  const { action, payload } = request;
  if (action === 'ai.chat' || action === 'ai.analyze') {
    const body = parseAiRequest({ ...payload, kind: action === 'ai.chat' ? 'chat' : 'analyze' });
    const keepalive = setInterval(() => { void browser.runtime.getPlatformInfo().catch(() => undefined); }, 20000);
    try {
      if(action==='ai.analyze'){
        const assignment=check(await client.from('ohmi_assignments').select('object_path,mime_type,size_bytes,status').eq('id',body.assignmentId!).eq('user_id',userId).single());
        if(!assignment||assignment.status!=='ready')throw new Error('Assignment is unavailable or incomplete.');
        if(assignment.mime_type==='application/pdf'){
          const file=check(await client.storage.from('ohmi-assignments').download(assignment.object_path));
          if(!file||file.size!==assignment.size_bytes||file.size>10485760||file.type!=='application/pdf')throw new Error('Stored PDF does not match its metadata. Reupload it.');
          body.pdfContext=await renderPrivatePdf(new Uint8Array(await file.arrayBuffer()));
          const current=await client.auth.getUser();
          if(current.error||current.data.user?.id!==userId)throw new Error('Account changed during PDF preparation. Sign in again.');
        }
      }
      const result = await client.functions.invoke('ohmi-ai', { body, signal: AbortSignal.timeout(110000) });
      if (result.error) throw new Error('AI connection failed. Check your internet/session and retry the same request.');
      if (!result.data?.ok) throw Object.assign(new Error(String(result.data?.error ?? 'AI request failed. Retry.').slice(0,220)), { code: result.data?.retryNew ? 'AI_RETRY_NEW' : 'AI_RETRY_SAME' });
      return result.data.data;
    } finally { clearInterval(keepalive); }
  }
  if (action === 'ai.conversations') return check(await client.from('ohmi_conversations').select('id,title,analysis_id,updated_at').eq('user_id',userId).order('updated_at',{ascending:false}).limit(50));
  if (action === 'ai.conversation.create') return check(await client.from('ohmi_conversations').insert({user_id:userId,analysis_id:payload.analysisId ? String(payload.analysisId) : null}).select('id,title,analysis_id,updated_at').single());
  if (action === 'ai.conversation.delete') { check(await client.from('ohmi_conversations').delete().eq('id',String(payload.conversationId)).eq('user_id',userId)); return null; }
  if (action === 'ai.messages') return check(await client.from('ohmi_messages').select('id,role,content,created_at,request_id').eq('conversation_id',String(payload.conversationId)).eq('user_id',userId).order('position',{ascending:false}).limit(100))?.reverse();
  if (action === 'ai.analyses') return check(await client.from('ohmi_analyses').select('id,assignment_id,language,payload,model,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50))?.map(row=>({...row,payload:parseAnalysis(row.payload)}));
  if (action === 'ai.analysis') {
    const row = check(await client.from('ohmi_analyses').select('id,assignment_id,language,payload,model,created_at').eq('id',String(payload.analysisId)).eq('user_id',userId).single());
    if (!row) throw new Error('Saved analysis is unavailable. Refresh assignments.');
    const progress=check(await client.from('ohmi_tutorial_progress').select('current_step,completed').eq('analysis_id',row.id).eq('user_id',userId).maybeSingle());
    return { analysis:{...row,payload:parseAnalysis(row.payload)},currentStep:progress?.current_step??0,completed:progress?.completed??[] };
  }
  if (action === 'ai.progress.save') { check(await client.rpc('ohmi_save_tutorial_progress',{p_analysis_id:String(payload.analysisId),p_current_step:Number(payload.currentStep),p_completed:payload.completed as number[]})); return null; }
  if (action === 'ai.usage') return check(await client.from('ohmi_ai_requests').select('kind,status,input_tokens,output_tokens,created_at').eq('user_id',userId).gte('created_at',new Date().toISOString().slice(0,10)+'T00:00:00Z'));
  throw new Error('Unknown AI action.');
}
