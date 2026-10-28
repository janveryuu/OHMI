"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { MotionConfig } from "motion/react";
import type { User } from "@supabase/supabase-js";
import { backendClient } from "@/lib/backend/client";
import {
  accountEpoch,
  selectActiveConversation,
  safeReturnPath,
} from "@/lib/backend/guards.mjs";
import {
  workspaceData,
  conversationMessages,
  checked,
  type Analysis,
  type StoredConversation,
  type StoredFile,
  type StoredMessage,
  mergeConversationPage,
} from "@/lib/backend/data";

export type Message = StoredMessage;
export type Conversation = StoredConversation;
export type LocalFile = StoredFile;
type State = {
  user: User | null;
  configured: boolean;
  loading: boolean;
  error: string;
  analyses: Analysis[];
  savedProgress: {
    analysis_id: string;
    current_step: number;
    completed: number[];
  }[];
  refresh: () => Promise<void>;
  signIn: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (value: { name?: string; language?: string }) => Promise<void>;
  uploadFile: (
    file: File,
    options?: {
      onStage?: (
        stage: "preparing" | "uploading" | "processing" | "saving" | "complete",
      ) => void;
      signal?: AbortSignal;
    },
  ) => Promise<string>;
  removeFile: (id: string) => Promise<void>;
  newConversation: (title?: string) => Promise<string>;
  loadOlder: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  saveProgress: (
    id: string,
    currentStep: number,
    completed: number[],
  ) => Promise<void>;
  refreshConversation: (id: string) => Promise<void>;
  saveGuideStep: (step: number, done: boolean) => Promise<void>;
  theme: string;
  setTheme: (value: string) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  largeText: boolean;
  setLargeText: (value: boolean) => void;
  language: string;
  setLanguage: (value: string) => void;
  conversations: Conversation[];
  activeChat: string;
  setActiveChat: (id: string) => void;
  files: LocalFile[];
  completed: boolean[];
  name: string;
  toast: (message: string) => void;
};
const Context = createContext<State | null>(null);
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing OHMI context");
  return state;
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("light"),
    [reduceMotion, setReduceMotion] = useState(false),
    [largeText, setLargeText] = useState(false);
  const [language, updateLanguage] = useState("English"),
    [name, updateName] = useState(""),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [activeChat, setActiveChat] = useState(""),
    [files, setFiles] = useState<LocalFile[]>([]),
    [completed, setCompleted] = useState<boolean[]>(Array(5).fill(false)),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [analyses, setAnalyses] = useState<Analysis[]>([]),
    [savedProgress, setSavedProgress] = useState<
      { analysis_id: string; current_step: number; completed: number[] }[]
    >([]);
  const epoch = useRef(accountEpoch()),
    currentUser = useRef<User | null>(null),
    reads = useRef<AbortController | null>(null),
    messageRead = useRef<AbortController | null>(null),
    messageSequence = useRef(0);
  const client = typeof window !== "undefined" ? backendClient() : null;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const clearPrivate = useCallback(() => {
    epoch.current.advance();
    reads.current?.abort();
    messageRead.current?.abort();
    setConversations([]);
    setActiveChat("");
    setFiles([]);
    setAnalyses([]);
    setSavedProgress([]);
    setCompleted(Array(5).fill(false));
    updateName("");
    updateLanguage("English");
    setError("");
  }, []);
  const refresh = useCallback(async () => {
    const owner = currentUser.current;
    if (!client || !owner) return;
    reads.current?.abort();
    const controller = new AbortController();
    reads.current = controller;
    const generation = epoch.current.capture();
    setError("");
    try {
      const data = await workspaceData(client, owner.id, controller.signal);
      if (controller.signal.aborted || !epoch.current.current(generation))
        return;
      updateName(
        data.profile?.display_name || owner.user_metadata?.full_name || "",
      );
      updateLanguage(
        (
          {
            english: "English",
            filipino: "Filipino",
            taglish: "Taglish",
          } as Record<string, string>
        )[data.profile?.language || "english"] || "English",
      );
      setFiles(data.files);
      setAnalyses(data.analyses);
      setSavedProgress(data.progress);
      const guide = data.analyses.find(
        (a) => a.model === "ohmi-curated-led-v1",
      );
      const done =
        data.progress.find((p) => p.analysis_id === guide?.id)?.completed || [];
      setCompleted(Array.from({ length: 5 }, (_, i) => done.includes(i)));
      setConversations((previous) =>
        data.conversations.map((c) => {
          const prior = previous.find((p) => p.id === c.id);
          return {
            ...c,
            messages: prior?.messages || [],
            hasOlder: prior?.hasOlder,
            loaded: prior?.loaded || false,
          };
        }),
      );
      setActiveChat((current) =>
        selectActiveConversation(current, data.conversations),
      );
    } catch (cause) {
      if (!controller.signal.aborted && epoch.current.current(generation))
        setError(
          cause instanceof Error
            ? cause.message
            : "Your workspace could not be loaded.",
        );
    } finally {
      if (epoch.current.current(generation) && !controller.signal.aborted)
        setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true,
      authRevision = 0;
    const accept = (next: User | null) => {
      if (!mounted) return;
      if (currentUser.current?.id !== next?.id) clearPrivate();
      currentUser.current = next;
      setUser(next);
      setLoading(Boolean(next));
      if (next) void refresh();
    };
    void client.auth.getUser().then(({ data, error }) => {
      if (error && (error.status === 0 || (error.status ?? 0) >= 500))
        setError("Account services are temporarily unavailable.");
      if (authRevision === 0) accept(data.user);
    }).catch(() => {
      if (mounted && authRevision === 0) {
        setError("Account services are temporarily unavailable.");
        accept(null);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      setTimeout(() => accept(session?.user ?? null), 0);
    });
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      reads.current?.abort();
      messageRead.current?.abort();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [client, clearPrivate, refresh]);
  useEffect(() => {
    if (!client || !user || !activeChat) return;
    const generation = epoch.current.capture(),
      sequence = ++messageSequence.current;
    messageRead.current?.abort();
    const controller = new AbortController();
    messageRead.current = controller;
    void conversationMessages(
      client,
      user.id,
      activeChat,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (
          controller.signal.aborted ||
          !epoch.current.current(generation) ||
          sequence !== messageSequence.current
        )
          return;
        setConversations((previous) =>
          previous.map((c) => (c.id === activeChat ? { ...c, ...data } : c)),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted && epoch.current.current(generation))
          setError("Conversation history could not be loaded. Try again.");
      });
    return () => controller.abort();
  }, [client, user, activeChat]);
  async function requireAccount() {
    if (!client || !currentUser.current)
      throw new Error("Sign in to use your private workspace.");
    return {
      client,
      owner: currentUser.current,
      generation: epoch.current.capture(),
    };
  }
  async function signIn(next = "/app/") {
    if (!client) throw new Error("Account services are not configured.");
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "https://meetohmi.vercel.app";
    // Keep the registered OAuth callback exact; validate this route again on return.
    document.cookie = `ohmi-web-return=${safeReturnPath(next)}; Path=/app/; Max-Age=600; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin + "/app/auth/callback/" },
    });
    if (result.error) {
      document.cookie = "ohmi-web-return=; Path=/app/; Max-Age=0; SameSite=Lax";
      throw new Error("Google sign-in could not be started. Try again.");
    }
  }
  async function signOut() {
    if (!client) return;
    const result = await client.auth.signOut({ scope: "local" });
    if (result.error) throw new Error("Sign-out could not finish. Try again.");
    clearPrivate();
    currentUser.current = null;
    setUser(null);
    window.location.replace("/app/login/");
  }
  async function saveProfile(value: { name?: string; language?: string }) {
    const { client, owner, generation } = await requireAccount();
    const fields = {
      ...(value.name !== undefined
        ? { display_name: value.name.trim().slice(0, 80) }
        : {}),
      ...(value.language ? { language: value.language.toLowerCase() } : {}),
    };
    checked(
      await client
        .from("ohmi_profiles")
        .update(fields)
        .eq("id", owner.id)
        .select("id")
        .single(),
    );
    if (epoch.current.current(generation)) await refresh();
  }
  function setLanguage(value: string) {
    const previous = language;
    updateLanguage(value);
    if (!currentUser.current) return;
    void saveProfile({ language: value }).catch((cause) => {
      updateLanguage((current) => (current === value ? previous : current));
      setError(cause.message);
    });
  }
  async function uploadFile(
    file: File,
    options?: {
      onStage?: (
        stage: "preparing" | "uploading" | "processing" | "saving" | "complete",
      ) => void;
      signal?: AbortSignal;
    },
  ) {
    if (options?.signal?.aborted) throw new Error("Upload was cancelled.");
    options?.onStage?.("preparing");
    const { client, generation } = await requireAccount();
    const call = async (body: Record<string, unknown>) => {
      const response = await fetch("/app/api/files/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload did not finish.");
      return data;
    };
    const prepared = await call({
      action: "prepare",
      file: { name: file.name, type: file.type, size: file.size },
    });
    if (!epoch.current.current(generation))
      throw new Error("Account changed. Refresh your library.");
    if (options?.signal?.aborted) throw new Error("Upload was cancelled.");
    options?.onStage?.("uploading");
    try {
      const stored = await client.storage
        .from("ohmi-assignments")
        .upload(prepared.path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "0",
        });
      if (stored.error)
        throw new Error(
          "Upload did not finish. Remove the pending material and retry.",
        );
      if (!epoch.current.current(generation))
        throw new Error("Account changed. Refresh your library.");
      if (options?.signal?.aborted) throw new Error("Upload was cancelled.");
      options?.onStage?.("processing");
      await call({ action: "finalize", id: prepared.id });
      if (!epoch.current.current(generation))
        throw new Error("Account changed. Refresh your library.");
      options?.onStage?.("saving");
      await refresh();
      options?.onStage?.("complete");
      return prepared.id as string;
    } catch (cause) {
      if (epoch.current.current(generation)) await refresh();
      throw cause;
    }
  }

  async function removeFile(id: string) {
    const { generation } = await requireAccount();
    const response = await fetch(`/app/api/files/${id}/`, { method: "DELETE" });
    if (!response.ok)
      throw new Error(
        (await response.json()).error || "Material could not be removed.",
      );
    if (epoch.current.current(generation)) await refresh();
  }
  async function newConversation(title = "New conversation") {
    const { client, owner, generation } = await requireAccount();
    const data = checked(
      await client
        .from("ohmi_conversations")
        .insert({
          user_id: owner.id,
          title: title.slice(0, 160) || "New conversation",
        })
        .select("id,title")
        .single(),
    );
    if (!epoch.current.current(generation))
      throw new Error("Account changed. Reopen your workspace.");
    if (!data) throw new Error("Conversation could not be created.");
    setConversations((previous) => [
      { ...data, messages: [], loaded: true },
      ...previous,
    ]);
    setActiveChat(data.id);
    return data.id as string;
  }
  async function loadOlder(id: string) {
    const { client, owner, generation } = await requireAccount();
    const conversation = conversations.find((c) => c.id === id);
    const before = conversation?.messages[0]?.position;
    if (!before) return;
    const data = await conversationMessages(client, owner.id, id, before);
    if (epoch.current.current(generation))
      setConversations((previous) =>
        previous.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: [...data.messages, ...c.messages],
                hasOlder: data.hasOlder,
              }
            : c,
        ),
      );
  }
  async function deleteConversation(id: string) {
    const { client, owner, generation } = await requireAccount();
    checked(
      await client
        .from("ohmi_conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", owner.id)
        .select("id")
        .single(),
    );
    if (epoch.current.current(generation)) {
      if (activeChat === id) setActiveChat("");
      await refresh();
    }
  }
  async function refreshConversation(id: string) {
    const { client, owner, generation } = await requireAccount();
    const data = await conversationMessages(client, owner.id, id);
    if (epoch.current.current(generation))
      setConversations((previous) =>
        previous.map((c) => c.id === id ? mergeConversationPage(c, data) : c),
      );
  }
  async function saveProgress(
    id: string,
    currentStep: number,
    values: number[],
  ) {
    const { client, generation } = await requireAccount();
    checked(
      await client.rpc("ohmi_save_tutorial_progress", {
        p_analysis_id: id,
        p_current_step: currentStep,
        p_completed: values,
      }),
    );
    if (epoch.current.current(generation))
      setSavedProgress((previous) => [
        { analysis_id: id, current_step: currentStep, completed: values },
        ...previous.filter((p) => p.analysis_id !== id),
      ]);
  }
  async function saveGuideStep(step: number, done: boolean) {
    const { generation } = await requireAccount();
    let id = analyses.find((a) => a.model === "ohmi-curated-led-v1")?.id;
    if (!id) {
      const response = await fetch("/app/api/guide/", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.analysisId)
        throw new Error(data.error || "Guide could not be saved.");
      id = data.analysisId;
    }
    if (!epoch.current.current(generation))
      throw new Error("Account changed. Reopen the guide.");
    const values = completed.map((value, index) =>
      index === step ? done : value,
    );
    await saveProgress(
      id!,
      step,
      values.flatMap((value, index) => (value ? [index] : [])),
    );
    if (epoch.current.current(generation)) {
      setCompleted(values);
      await refresh();
    }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("ohmi-preferences") || "{}",
      );
      if (["system", "light", "dark"].includes(saved.theme))
        setTheme(saved.theme);
      setReduceMotion(saved.reduceMotion === true);
      setLargeText(saved.largeText === true);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const selected =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = selected;
      const background = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((meta) => meta.setAttribute("content", background));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    document.documentElement.dataset.largeText = String(largeText);
    if (ready)
      try {
        localStorage.setItem(
          "ohmi-preferences",
          JSON.stringify({ theme, reduceMotion, largeText }),
        );
      } catch {}
  }, [theme, reduceMotion, largeText, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <Context.Provider
      value={{
        user,
        configured,
        loading,
        error,
        analyses,
        savedProgress,
        refresh,
        signIn,
        signOut,
        saveProfile,
        uploadFile,
        removeFile,
        newConversation,
        loadOlder,
        deleteConversation,
        saveProgress,
        refreshConversation,
        saveGuideStep,
        theme,
        setTheme,
        reduceMotion,
        setReduceMotion,
        largeText,
        setLargeText,
        language,
        setLanguage,
        conversations,
        activeChat,
        setActiveChat,
        files,
        completed,
        name,
        toast: setNotice,
      }}
    >
      <MotionConfig
        reducedMotion={reduceMotion ? "always" : "user"}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {children}
        <div className="toast" role="status" aria-live="polite">
          {notice && <span>{notice}</span>}
        </div>
      </MotionConfig>
    </Context.Provider>
  );
}
