import {pdfContents,pdfSourceComponents,validatePdfReferences} from './ai-pdf.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAiRequest, parseAnalysis, type AiRequest, type Content } from './ai-core.ts';
import { resolveAnalysisCurrents } from './ai-math.ts';
import { estimateRequestTokens, generateWithFallback } from './ai-providers.ts';
export type ScopedAi = { userId: string; user: SupabaseClient; admin: SupabaseClient; key: string; groqKey?: string; geminiFree?: boolean; groqFree?: boolean };
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
function db<T>(result: { data: T; error: unknown }, message: string, optional: true): T;
function db<T>(result: { data: T; error: unknown }, message: string): NonNullable<T>;
function db<T>(result: { data: T; error: unknown }, message: string, optional = false) { if (result.error || (!optional && result.data === null)) throw new Error(message); return result.data; }
async function body(request: Request) {
  if (!request.body) throw new Error('Missing AI request.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 4000000) { await reader.cancel(); throw new Error('AI request is too large.'); } chunks.push(part.value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const input=JSON.parse(new TextDecoder().decode(bytes));
  if(length>32768&&!input?.pdfContext)throw new Error('AI request is too large.');
  return input;
}
async function hash(value: unknown) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function result(scope: ScopedAi, request: AiRequest, resultId: string) {
  const table = request.kind === 'chat' ? 'ohmi_messages' : 'ohmi_analyses';
  const saved = db(await scope.user.from(table).select('*').eq('id', resultId).eq('user_id', scope.userId).single(), 'Saved AI result is unavailable. Refresh history or assignments.');
  if (request.kind === 'analyze') saved.payload = parseAnalysis(saved.payload);
  return saved;
}
export function createAiHandler(authenticate: (authorization: string) => Promise<ScopedAi>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405);
    const authorization = request.headers.get('Authorization') ?? '';
    if (!/^Bearer \S+$/.test(authorization)) return json({ ok: false, error: 'Sign in to use OHMI AI.' }, 401);
    let scope: ScopedAi;
    try { scope = await authenticate(authorization); } catch { return json({ ok: false, error: 'Session expired. Sign in again.' }, 401); }
    let input: AiRequest;
    try { input = parseAiRequest(await body(request)); if (input.accountId !== scope.userId) throw new Error('Account changed. Refresh before continuing.'); }
    catch (error) { return json({ ok: false, error: error instanceof Error && !(error instanceof SyntaxError) ? error.message : 'Invalid AI request.' }, 400); }
    if (!scope.key) return json({ ok: false, error: 'AI setup is pending. Ask the owner to configure Gemini.' }, 503);

    // Return headers promptly; whitespace keeps a valid JSON body while the model works.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder(); let connected = true; let reserved = false;
        const write = (value: string) => { if (!connected) return; try { controller.enqueue(encoder.encode(value)); } catch { connected = false; } };
        write('\n'); const timer = setInterval(() => write('\n'), 10000);
        try {
          const user = scope.user;
          const profile = db(await user.from('ohmi_profiles').select('language').eq('id', scope.userId).single(), 'Account preferences could not be loaded. Retry.');
          const language = profile.language;
          const inputHash = await hash({ input, language });
          const reserveArgs = { p_user_id: scope.userId, p_request_id: input.requestId, p_kind: input.kind, p_target: input.kind === 'chat' ? input.conversationId : input.assignmentId, p_hash: inputHash, p_language: language };
          const existing = db(await user.from('ohmi_ai_requests').select('input_hash,status,result_id').eq('id', input.requestId).eq('user_id', scope.userId).maybeSingle(), 'AI request status could not be checked. Retry.', true);
          if (existing) {
            if (existing.input_hash !== inputHash) { write(JSON.stringify({ok:false,error:'Request or language changed. Start a new attempt.',retryNew:true})); return; }
            if (existing.status === 'completed') { write(JSON.stringify({ ok: true, data: await result(scope, input, existing.result_id), cached: true })); return; }
            if (existing.status === 'pending') {
              const resolved = db(await scope.admin.rpc('ohmi_reserve_ai', reserveArgs),'AI request status could not be resolved. Retry.');
              if (resolved.status === 'completed') { write(JSON.stringify({ok:true,data:await result(scope,input,resolved.result_id),cached:true})); return; }
              write(JSON.stringify({ok:false,error:resolved.status==='failed'?'That AI request expired. Try a new attempt.':'An AI request is still running. Retry shortly.',retryNew:resolved.status==='failed'})); return;
            }
            write(JSON.stringify({ ok: false, error: 'That AI request failed. Try a new attempt.', retryNew: true })); return;
          }
          const contents: Content[] = [];let pdfRoute=false;
          let assignment: { id: string; object_path: string; mime_type: string; size_bytes: number } | undefined;
          if (input.kind === 'analyze') {
            assignment = db(await user.from('ohmi_assignments').select('id,object_path,mime_type,size_bytes').eq('id', input.assignmentId).eq('user_id', scope.userId).eq('status', 'ready').single(), 'Assignment unavailable or incomplete. Refresh your files.');
            pdfRoute=assignment!.mime_type==='application/pdf';
            const cached = db(await user.from('ohmi_analyses').select('*').eq('assignment_id', assignment!.id).eq('language', language).eq('user_id', scope.userId).maybeSingle(), 'Saved analysis could not be loaded.', true);
            if (cached) { cached.payload = parseAnalysis(cached.payload); write(JSON.stringify({ ok: true, data: cached, cached: true })); return; }
          if(pdfRoute&&!input.pdfContext)throw new Error('Prepare this PDF using the updated OHMI extension before analysis.');
          } else {
            const conversation = db(await user.from('ohmi_conversations').select('id,analysis_id').eq('id', input.conversationId).eq('user_id', scope.userId).single(), 'Conversation unavailable. Start a new conversation.');
            if (conversation.analysis_id) {
              const analysis = db(await user.from('ohmi_analyses').select('payload,assignment_id').eq('id', conversation.analysis_id).eq('user_id', scope.userId).single(), 'Assignment context is unavailable.');
              const linked=db(await user.from('ohmi_assignments').select('mime_type').eq('id',analysis.assignment_id).eq('user_id',scope.userId).single(),'Assignment source is unavailable.');
              pdfRoute=linked.mime_type==='application/pdf';
              const parsed = parseAnalysis(analysis.payload);
              if (input.stepIndex !== undefined && input.stepIndex >= parsed.steps.length) throw new Error('Tutorial step is no longer available.');
              const context = {...parsed,steps:input.stepIndex===undefined?[]:[parsed.steps[input.stepIndex]]};
              contents.push({ role: 'user', parts: [{ text: `UNTRUSTED SAVED ASSIGNMENT CONTEXT:\n${JSON.stringify(context)}\nCurrent step: ${input.stepIndex ?? 'general assignment question'}` }] });
            } else if (input.stepIndex !== undefined) throw new Error('Choose an assignment tutorial before asking about its step.');
            const history = db(await user.from('ohmi_messages').select('role,content').eq('conversation_id', conversation.id).eq('user_id', scope.userId).order('position', { ascending: false }).limit(12), 'Conversation history could not be loaded.');
            for (const message of history.reverse()) contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] });
            contents.push({ role: 'user', parts: [{ text: input.message! }] });
          }
          if (!scope.geminiFree) throw new Error('AI is paused until the owner confirms free-tier access. No paid billing is enabled by OHMI.');
          const reservation = await scope.admin.rpc('ohmi_reserve_ai', {...reserveArgs,p_estimated_tokens:estimateRequestTokens(input.pdfContext?pdfContents(input.pdfContext):contents,input.kind==='analyze',input.pdfContext?undefined:assignment)});
          if (reservation.error) {
            const message = String(reservation.error.message ?? '');
            throw new Error(/limit|budget|still running|replay/i.test(message) ? message.slice(0, 180) : 'AI request could not be reserved. Retry.');
          }
          if (!reservation.data.fresh) throw new Error('An AI request is still running. Retry shortly.');
          reserved = true;
          if (assignment) {
            const file = db(await user.storage.from('ohmi-assignments').download(assignment.object_path), 'Assignment file could not be read. Retry or reupload it.');
            if (!file || file.size !== assignment.size_bytes || file.size > 10485760 || file.type !== assignment.mime_type) throw new Error('Stored file does not match assignment metadata. Reupload it.');
            const bytes = new Uint8Array(await file.arrayBuffer());
            const signature = assignment.mime_type === 'application/pdf' ? [37,80,68,70,45] : assignment.mime_type === 'image/png' ? [137,80,78,71,13,10,26,10] : assignment.mime_type === 'image/jpeg' ? [255,216,255] : [];
            if (!signature.length || !signature.every((byte,index) => bytes[index] === byte)) throw new Error('Stored document has an invalid signature. Reupload it.');
            if(assignment.mime_type==='application/pdf'){
              if(!input.pdfContext)throw new Error('PDF analysis requires local preparation. Reload the updated OHMI extension.');
              const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
              if(digest!==input.pdfContext.sha256)throw new Error('PDF source changed. Prepare the original assignment again.');
              let binary = ''; for (let offset=0; offset<bytes.length; offset+=8192) binary += String.fromCharCode(...bytes.subarray(offset, offset+8192));
              contents.push({role:'user',parts:[{text:'Analyze the original PDF assignment. Cite PDF page N in every component detail and teaching step. Read all pages; preserve stated counts, values and pin labels.'},{inlineData:{mimeType:'application/pdf',data:btoa(binary)}}]});
            }else{
              if(input.pdfContext)throw new Error('PDF context cannot be attached to an image assignment.');
              let binary = ''; for (let offset=0; offset<bytes.length; offset+=8192) binary += String.fromCharCode(...bytes.subarray(offset, offset+8192));
              contents.push({ role: 'user', parts: [{ text: 'Analyze this assignment and generate an honest, manageable teaching guide.' }, { inlineData: { mimeType: assignment.mime_type, data: btoa(binary) } }] });
            }
          }
          const rows=db(await scope.admin.from('ohmi_ai_provider_backoffs').select('model,blocked_until').gt('blocked_until',new Date().toISOString()).abortSignal(AbortSignal.timeout(5000)), 'Provider availability could not be checked. Retry.');
          const backoffs=Object.fromEntries(rows.map((row:{model:string;blocked_until:string})=>[row.model,row.blocked_until]));
          const generated = await generateWithFallback({gemini:scope.key,groq:scope.groqKey,geminiFree:scope.geminiFree===true,groqFree:scope.groqFree===true}, { contents, language, analysis: input.kind === 'analyze',pdf:pdfRoute },fetch,{backoffs,primaryOnly:true,onQuota:async(model,seconds)=>{
            const saved=await scope.admin.rpc('ohmi_defer_ai_provider',{p_model:model,p_retry_after:seconds}).abortSignal(AbortSignal.timeout(5000));
            if(saved.error)throw new Error('Provider quota state could not be saved.');
          }});
          // Successful provider usage must survive a rejected guide or account deletion.
          const metered=await scope.admin.from('ohmi_ai_requests').update({model:generated.model,input_tokens:generated.inputTokens,output_tokens:generated.outputTokens,accounted_tokens:generated.accountedTokens}).eq('id',input.requestId).eq('input_hash',inputHash).in('status',['pending','failed']).select('id').abortSignal(AbortSignal.timeout(5000));
          if(metered.error||!metered.data?.length)throw new Error('AI usage could not be recorded. Saved work is unchanged.');
          const parsed=input.kind==='analyze'?JSON.parse(generated.text):undefined;
          const components=input.pdfContext?pdfSourceComponents(input.pdfContext):undefined;
          if(components&&parsed&&typeof parsed==='object'&&!Array.isArray(parsed))parsed.components=components;
          const prepared=input.pdfContext?validatePdfReferences(parseAnalysis(parsed),input.pdfContext,true):parsed;
          const output = input.kind === 'chat' ? { message: input.message, answer: generated.text } : resolveAnalysisCurrents(prepared);
          const saved = db(await scope.admin.rpc('ohmi_complete_ai', { p_request_id: input.requestId, p_output: output, p_input_tokens: generated.inputTokens, p_output_tokens: generated.outputTokens, p_model:generated.model, p_accounted_tokens:generated.accountedTokens }), 'AI answered but could not save. Retry the same request to check history.');
          write(JSON.stringify({ ok: true, data: await result(scope, input, saved.id), cached: false }));
        } catch (error) {
          let retryNew = false;
          if (reserved) {
            const failed = await Promise.resolve(scope.admin.from('ohmi_ai_requests').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', input.requestId).eq('user_id', scope.userId).eq('status', 'pending').select('id')).catch(() => ({ data: [], error: true }));
            retryNew = !failed.error && !!failed.data?.length;
          }
          const message = error instanceof SyntaxError ? 'AI analysis was invalid. Try a clearer document.' : error instanceof Error ? error.message.slice(0, 220) : 'AI could not complete this request. Retry.';
          write(JSON.stringify({ ok: false, error: message, retryNew }));
        } finally { clearInterval(timer); if (connected) { try { controller.close(); } catch { /* The caller disconnected; saved results remain private. */ } } }
      },
    });
    return new Response(stream, { headers });
  };
}
