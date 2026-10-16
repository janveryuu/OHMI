// Supabase Edge Function: ohmi-ai
// Thin serving entry delegating to handleAiRequest
import { handleAiRequest } from './handler.ts';

Deno.serve(async (req: Request) => {
  return handleAiRequest(req);
});
