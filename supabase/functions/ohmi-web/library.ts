import { createClient } from "npm:@supabase/supabase-js@2";
import { curatedGuide } from "./guide.ts";
interface Dependencies {
  createClient?: (...args: any[]) => any;
  env?: Record<string, string>;
}
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
};
export async function handleLibraryRequest(
  request: Request,
  deps: Dependencies = {},
) {
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST")
    return respond({ error: "Method not allowed." }, 405);
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token)
    return respond({ error: "Sign in to save learning progress." }, 401);
  const env = (key: string) =>
    deps.env?.[key] ?? (globalThis as any).Deno?.env.get(key) ?? "";
  const url = env("SUPABASE_URL"),
    publicKey = env("SUPABASE_ANON_KEY"),
    secret = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publicKey || !secret)
    return respond({ error: "Learning services are not configured." }, 503);
  const factory = deps.createClient || createClient;
  const userClient = factory(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);
  if (error || !user)
    return respond({ error: "Sign in to save learning progress." }, 401);
  const admin = factory(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("ohmi-curated-led-v1"),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const existing = () =>
    admin
      .from("ohmi_analyses")
      .select("id")
      .eq("user_id", user.id)
      .eq("fingerprint", fingerprint)
      .maybeSingle();
  const found = await existing();
  if (found.error)
    return respond({ error: "Saved guide could not be loaded." }, 503);
  if (found.data) return respond({ analysisId: found.data.id });
  const inserted = await admin
    .from("ohmi_analyses")
    .insert({
      user_id: user.id,
      assignment_id: null,
      language: "english",
      payload: curatedGuide,
      model: "ohmi-curated-led-v1",
      schema_version: 1,
      artifact_kind: "tutorial",
      provider: "ohmi-curated",
      fingerprint,
      title: curatedGuide.title,
      prompt_version: 1,
    })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const raced = await existing();
      if (!raced.error && raced.data)
        return respond({ analysisId: raced.data.id });
    }
    return respond(
      { error: "Guide enrollment could not be saved. Try again." },
      503,
    );
  }
  if (!inserted.data?.id)
    return respond(
      { error: "Guide enrollment did not confirm a saved record." },
      503,
    );
  return respond({ analysisId: inserted.data.id });
}
