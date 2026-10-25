import { isTerminalAiCode } from "./guards.mjs";

function failure(data: Record<string, any>) {
  return Object.assign(new Error(typeof data.error === 'string' ? data.error : 'OHMI could not confirm a saved result. Check this request again before starting a new one.'), {
    terminal: isTerminalAiCode(data.code), code: data.code, retryAfterSeconds: data.retryAfterSeconds,
  });
}

// Recovery is read-only. A POST is sent only when this UUID has no existing request.
export async function askBackend(payload: Record<string, unknown>, signal?: AbortSignal) {
  const lookup = async () => {
    const response = await fetch(`/app/api/ai/requests/${encodeURIComponent(String(payload.requestId))}/`, { cache: 'no-store', signal });
    if (response.status === 404) return null;
    const data = await response.json();
    if (!response.ok) throw failure(data);
    if (!data.ok || data.requestId !== payload.requestId) throw failure({});
    if (data.status === 'completed' && data.result) return data;
    if (data.status === 'expired') throw failure({ code: 'failed', error: 'The request lease expired without a saved result. You can submit a new attempt when ready.' });
    if (data.status === 'failed') {
      const msg = typeof data.error === 'string' && data.error && !data.error.includes('This request failed')
        ? data.error
        : typeof data.errorCode === 'string' && data.errorCode
          ? `Analysis request did not finish (${data.errorCode}). Submit a new attempt when ready.`
          : 'This request failed. You can submit a new attempt when ready.';
      throw failure({ code: 'failed', error: msg });
    }
    throw failure({ code: 'in_progress', error: 'This request is still being processed. Check it again before starting a new one.', retryAfterSeconds: 10 });
  };
  const saved = await lookup();
  if (saved) return saved;
  try {
    const response = await fetch('/app/api/ai/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
    const data = await response.json();
    if (!response.ok) throw failure(data);
    if (!data.ok || !data.result || data.requestId !== payload.requestId) throw failure({});
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      const recovered = await lookup();
      if (recovered) return recovered;
    } catch (lookupErr) {
      if (error && typeof error === 'object' && 'code' in error && (error as any).code) {
        throw error;
      }
      throw lookupErr;
    }
    throw error;
  }
}
