import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
export type StoredFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  status: "pending" | "ready";
};
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  position?: number;
  structured?: Record<string, unknown>;
  attachment?: string;
};
export type StoredConversation = {
  id: string;
  title: string;
  messages: StoredMessage[];
  hasOlder?: boolean;
  loaded?: boolean;
};
export type Analysis = {
  id: string;
  assignment_id: string | null;
  title: string | null;
  artifact_kind: string;
  model: string;
  provider: string;
  payload: Record<string, unknown>;
  created_at: string;
  language: string;
};
export function checked<T>(result: {
  data: T;
  error: { message: string } | null;
}): T {
  if (result.error)
    throw new Error("Your workspace could not be loaded or saved. Try again.");
  return result.data;
}
export async function workspaceData(
  client: SupabaseClient<Database>,
  userId: string,
  signal: AbortSignal,
) {
  checked(
    await client
      .from("ohmi_profiles")
      .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true })
      .abortSignal(signal),
  );
  const [profile, files, conversations, analyses, progress] = await Promise.all(
    [
      client
        .from("ohmi_profiles")
        .select("id,display_name,language")
        .eq("id", userId)
        .abortSignal(signal)
        .single(),
      client
        .from("ohmi_assignments")
        .select("id,original_name,mime_type,size_bytes,status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100)
        .abortSignal(signal),
      client
        .from("ohmi_conversations")
        .select("id,title")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50)
        .abortSignal(signal),
      client
        .from("ohmi_analyses")
        .select(
          "id,assignment_id,title,artifact_kind,model,provider,payload,created_at,language",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50)
        .abortSignal(signal),
      client
        .from("ohmi_tutorial_progress")
        .select("analysis_id,current_step,completed")
        .eq("user_id", userId)
        .limit(100)
        .abortSignal(signal),
    ],
  );
  return {
    profile: checked(profile),
    files: (checked(files) || []).map((f) => ({
      id: f.id,
      name: f.original_name,
      type: f.mime_type,
      size: f.size_bytes,
      status: f.status,
      url: `/app/api/files/${f.id}/`,
    })) as StoredFile[],
    conversations: (checked(conversations) || []).map((c) => ({
      ...c,
      messages: [],
    })) as StoredConversation[],
    analyses: (checked(analyses) || []) as Analysis[],
    progress: checked(progress) || [],
  };
}
export async function conversationMessages(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
  before?: number,
  signal?: AbortSignal,
) {
  let query = client
    .from("ohmi_messages")
    .select("id,role,content,position,structured_result")
    .eq("user_id", userId)
    .eq("conversation_id", id)
    .order("position", { ascending: false })
    .limit(50);
  if (before) query = query.lt("position", before);
  if (signal) query = query.abortSignal(signal);
  const rows = checked(await query) || [];
  return {
    loaded: true,
    messages: rows.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      text: m.content,
      position: m.position,
      structured: m.structured_result,
    })) as StoredMessage[],
    hasOlder: rows.length === 50 && rows[0]?.position > 1,
  };
}
