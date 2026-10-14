import { createClient } from '@supabase/supabase-js';
import { createAiHandler } from '../_shared/ai-handler.ts';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const url = Deno.env.get('SUPABASE_URL')!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(createAiHandler(async authorization => {
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { ...options, global: { headers: { Authorization: authorization } } });
  const verified = await user.auth.getUser(authorization.slice(7));
  if (verified.error || !verified.data.user || verified.data.user.is_anonymous) throw new Error('Authentication required');
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
  return { userId: verified.data.user.id, user, admin, key: Deno.env.get('GEMINI_API_KEY') ?? '', groqKey:Deno.env.get('GROQ_API_KEY'), geminiFree:Deno.env.get('GEMINI_FREE_TIER_CONFIRMED')==='true', groqFree:Deno.env.get('GROQ_FREE_TIER_CONFIRMED')==='true' };
}));
