import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
export function mergeConversationPage(conversation: StoredConversation, page: Pick<StoredConversation, 'messages' | 'hasOlder' | 'loaded'>): StoredConversation {
  // Keep pagination contiguous when another device has added more than one page.
  if ((page.messages[0]?.position || 0) > (conversation.messages.at(-1)?.position || 0) + 1) return { ...conversation, ...page };
  return {
    ...conversation, ...page,
    messages: [...conversation.messages.filter(old => !page.messages.some(message => message.id === old.id)), ...page.messages].sort((a, b) => (a.position || 0) - (b.position || 0)),
    hasOlder: conversation.loaded && conversation.messages[0]?.position && conversation.messages[0].position < (page.messages[0]?.position || 0) ? conversation.hasOlder : page.hasOlder,
  };
}
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
  requestId?: string;
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
  try {
    await client
      .from("ohmi_profiles")
      .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true })
      .abortSignal(signal);
  } catch {}
  const [profile, files, conversations, analyses, progress] = await Promise.all(
    [
      client
        .from("ohmi_profiles")
        .select("id,display_name,language,avatar")
        .eq("id", userId)
        .abortSignal(signal)
        .maybeSingle()
        .then(async (res) => {
          if (res.error && res.error.message?.includes("avatar")) {
            const fallback = await client
              .from("ohmi_profiles")
              .select("id,display_name,language")
              .eq("id", userId)
              .abortSignal(signal)
              .maybeSingle();
            return {
              data: fallback.data ? { ...fallback.data, avatar: "" } : null,
              error: fallback.error,
            };
          }
          return res;
        }),
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
    profile: checked(profile) || {
      id: userId,
      display_name: "",
      language: "english",
      avatar: "",
    },
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
    .select("id,role,content,position,structured_result,request_id")
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
      requestId: m.request_id || undefined,
      structured: m.structured_result,
    })) as StoredMessage[],
    hasOlder: rows.length === 50 && rows[0]?.position > 1,
  };
}
