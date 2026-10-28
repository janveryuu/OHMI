import { authenticatedClient, PRIVATE_HEADERS, privateError } from '@/lib/backend/server';
import { requireUuid } from '@/lib/backend/guards.mjs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client, user } = await authenticatedClient();
    const id = requireUuid((await context.params).id);
    const { data: job, error } = await client.from('ohmi_ai_requests')
      .select('id,status,operation,language,model,result_id,result_payload,conversation_id,error_code,created_at')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!job) return Response.json({ code: 'not_found', error: 'Request not found.' }, { status: 404, headers: PRIVATE_HEADERS });
    let result = job.result_payload;
    if (job.status === 'completed' && !result) {
      // Legacy chat results are immutable per request; analyses can have been overwritten.
      const { data: message, error } = await client.from('ohmi_messages')
        .select('content,structured_result').eq('request_id', id).eq('user_id', user.id).eq('role', 'assistant').maybeSingle();
      if (error) throw error;
      result = message?.structured_result || (message?.content ? { status: 'answer', answer: message.content } : null);
    }
    if (job.status === 'completed' && !result && job.operation === 'circuit_check' && job.result_id) {
      const { data: analysis, error } = await client.from('ohmi_analyses').select('payload')
        .eq('id', job.result_id).eq('user_id', user.id).eq('artifact_kind', 'circuit_check').maybeSingle();
      if (error) throw error;
      result = analysis?.payload || null;
    }
    if (job.status === 'completed' && !result) return Response.json({ code: 'result_unavailable', error: 'The original saved result is no longer available. No new generation was started.' }, { status: 410, headers: PRIVATE_HEADERS });
    const provenance = result && typeof result === 'object' && !Array.isArray(result) ? result : {};
    return Response.json({ ok: true, requestId: job.id, accountId: user.id, status: job.status === 'pending' && Date.now() - Date.parse(job.created_at) > 60_000 ? 'expired' : job.status,
      operation: job.operation, language: job.language, model: typeof provenance.model === 'string' ? provenance.model : job.model, provider: typeof provenance.provider === 'string' ? provenance.provider : undefined, resultId: job.result_id, analysisId: job.result_id,
      conversationId: job.conversation_id, result, errorCode: job.error_code }, { headers: PRIVATE_HEADERS });
  } catch (error) { return privateError(error); }
}
