"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  FileText,
  HelpCircle,
  History,
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { useApp } from "./app-provider";
import { RichText } from "./rich-text";
import { CodeBlock } from "./code-block";
import { CircuitActionCard } from "./chat";
import { askBackend } from "@/lib/backend/ai";
import { validateFile } from "@/lib/demo.mjs";
import {
  parseCircuitIntent,
  generateCircuit,
  type GeneratedCircuit,
} from "@/lib/playground/circuit-generator";
import { useRouter } from "next/navigation";

export type WorkspaceContext =
  | "Tinkercad Circuits"
  | "Arduino IDE"
  | "CircuitVerse"
  | "General Electronics";

export interface FloatingOhmiProps {
  isPip?: boolean;
  pipWindow?: Window | null;
  onClose?: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
}

export function FloatingOhmi({
  isPip = false,
  pipWindow = null,
  onClose,
  onMinimize,
  isMinimized = false,
}: FloatingOhmiProps) {
  const app = useApp();
  const router = useRouter();

  // Chat state
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isWide, setIsWide] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [context, setContext] = useState<WorkspaceContext>("Tinkercad Circuits");
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Optimistic message tracking
  const [optimisticUser, setOptimisticUser] = useState<{
    id: string;
    text: string;
    attachment?: string;
    status: "pending" | "failed";
    error?: string;
  } | null>(null);

  // References
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const submitting = useRef(false);
  const retry = useRef<{ key: string; requestId: string } | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const codeFileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastSubmittedText = useRef("");
  const lastAttachment = useRef<File | null>(null);

  // Current active conversation
  const conversation =
    app.conversations.find((c) => c.id === app.activeChat) ||
    app.conversations[0] || {
      id: "",
      title: "New conversation",
      messages: [],
      loaded: true,
    };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      request.current?.abort();
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation.messages?.length, pending, optimisticUser]);

  // Reset transient state when account changes
  useEffect(() => {
    sequence.current++;
    submitting.current = false;
    request.current?.abort();
    setPending(false);
    setDraft("");
    setAttachment(null);
    setOptimisticUser(null);
    setError("");
    uploaded.current = null;
    retry.current = null;
  }, [app.user?.id]);

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  }

  function handleDirectToPlayground(circuit?: GeneratedCircuit | null) {
    if (!circuit) {
      setError("No supported circuit template found for this design.");
      return;
    }
    try {
      const docStr = JSON.stringify(circuit.document);
      const specStr = JSON.stringify(circuit.spec);
      sessionStorage.setItem("ohmi_active_circuit_doc:" + (app.user?.id || "guest"), docStr);
      sessionStorage.setItem("ohmi_active_circuit_spec:" + (app.user?.id || "guest"), specStr);
      sessionStorage.setItem("ohmi_active_circuit_doc:guest", docStr);
      sessionStorage.setItem("ohmi_active_circuit_spec:guest", specStr);
      sessionStorage.setItem("ohmi_current_circuit_doc", docStr);
      sessionStorage.setItem("ohmi_playground_template", "custom");
    } catch {
      setError("Could not transfer the circuit to your workspace.");
      return;
    }
    if (router && typeof router.push === "function") {
      router.push("/playground/?template=custom");
    } else {
      window.location.assign("/app/playground/?template=custom");
    }
  }

  function stop() {
    sequence.current++;
    submitting.current = false;
    request.current?.abort();
    setPending(false);
    if (optimisticUser) {
      setDraft(optimisticUser.text);
      setAttachment(lastAttachment.current);
      setOptimisticUser(null);
    }
    setError("Stopped waiting. Your message has been restored to the input box.");
  }

  async function newChat() {
    request.current?.abort();
    sequence.current++;
    submitting.current = false;
    setPending(false);
    setOptimisticUser(null);
    setError("");
    try {
      await app.newConversation();
      setDraft("");
      setAttachment(null);
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chat could not be created.");
    }
  }

  // Handle sending a message
  async function send(
    event?: FormEvent,
    text = draft,
    continuation?: Record<string, unknown>,
    retryFile?: File | null,
  ) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || submitting.current) return;

    if (!app.user) {
      setError("Sign in to ask OHMI and save your conversation.");
      return;
    }

    if (conversation.id && !conversation.loaded) {
      setError("Your conversation is loading. Please wait a moment.");
      return;
    }

    submitting.current = true;
    const current = ++sequence.current;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");

    if (!continuation) {
      lastSubmittedText.current = value;
      const selectedFile = retryFile === undefined ? attachment : retryFile;
      lastAttachment.current = selectedFile;
      setOptimisticUser({
        id: crypto.randomUUID(),
        text: value,
        attachment: selectedFile?.name,
        status: "pending",
      });
      if (retryFile === undefined) {
        setDraft("");
        setAttachment(null);
      }
    }
    isNearBottomRef.current = true;

    try {
      const id = conversation.id || (await app.newConversation(value));
      if (current !== sequence.current) return;

      let assignmentId = typeof continuation?.assignmentId === "string" ? continuation.assignmentId : undefined;
      const attachedFile = continuation ? null : lastAttachment.current;

      if (attachedFile && !continuation) {
        if (uploaded.current?.file === attachedFile) {
          assignmentId = uploaded.current.id;
        } else {
          assignmentId = await app.uploadFile(attachedFile);
          uploaded.current = { file: attachedFile, id: assignmentId };
        }
      }

      if (current !== sequence.current) return;

      const operation = continuation
        ? continuation.operation
        : attachedFile
          ? attachedFile.type === "application/pdf"
            ? "pdf"
            : "image"
          : "chat";

      // Include contextual workspace tag if general chat
      const enrichedMessage =
        context && !value.toLowerCase().includes(context.toLowerCase())
          ? `[Workspace: ${context}]\n${value}`
          : value;

      const payload = {
        version: 1,
        operation,
        language: app.language.toLowerCase(),
        message: enrichedMessage,
        conversationId: id,
        historyThroughPosition: conversation.messages.at(-1)?.position || 0,
        ...(assignmentId ? { assignmentId } : {}),
        ...(typeof continuation?.circuitAnalysisId === "string"
          ? { circuitAnalysisId: continuation.circuitAnalysisId }
          : {}),
      };

      const key = JSON.stringify(payload);
      const fresh = retry.current?.key !== key;
      const requestId =
        retry.current?.key === key ? retry.current.requestId : crypto.randomUUID();
      retry.current = { key, requestId };

      await askBackend({ ...payload, requestId }, controller.signal, { fresh });
      if (current !== sequence.current) return;

      await app.refreshConversation(id);
      if (operation !== "chat") await app.refresh();
      if (current !== sequence.current) return;

      setOptimisticUser(null);
      if (!continuation) {
        uploaded.current = null;
      }
      retry.current = null;
    } catch (cause) {
      if (
        cause &&
        typeof cause === "object" &&
        "terminal" in cause &&
        cause.terminal === true
      ) {
        retry.current = null;
      }
      if (current === sequence.current) {
        const errorText =
          cause instanceof Error
            ? cause.message
            : "OHMI could not answer. Your question remains below.";
        setError(errorText);
        setOptimisticUser((prev) =>
          prev ? { ...prev, status: "failed", error: errorText } : null,
        );
      }
    } finally {
      if (current === sequence.current) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  // Handle keyboard events in textarea (Enter sends, Shift+Enter new line)
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  // Handle screenshot clipboard pasting
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const problem = validateFile(file);
          if (problem) {
            setError(problem);
          } else {
            setAttachment(file);
            setError("");
          }
          return;
        }
      }
    }
  }

  // Handle file drops
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      const problem = validateFile(file);
      if (problem) setError(problem);
      else {
        setAttachment(file);
        setError("");
      }
    } else if (/\.(ino|cpp|c|h|txt)$/i.test(file.name)) {
      void handleCodeFile(file);
    }
  }

  async function handleCodeFile(file: File) {
    try {
      const text = await file.text();
      const formatted = `\`\`\`arduino\n// ${file.name}\n${text}\n\`\`\`\n\n`;
      setDraft((prev) => (prev ? `${prev}\n\n${formatted}` : formatted));
      textareaRef.current?.focus();
    } catch {
      setError("Could not read code file.");
    }
  }

  // Quick action triggers
  function triggerCheckWiring() {
    if (attachment) {
      void send(
        undefined,
        "Please check my wiring in this circuit screenshot. Are the connections, pin placements, resistors, and polarities correct?",
      );
    } else {
      fileRef.current?.click();
    }
  }

  function triggerCheckCode() {
    setDraft((prev) => {
      const template = "Can you check and debug this Arduino sketch for my circuit?\n\n```arduino\nvoid setup() {\n  // put setup code here\n}\n\nvoid loop() {\n  // put main code here\n}\n```\n\nIssue/Error: ";
      return prev ? `${prev}\n\n${template}` : template;
    });
    textareaRef.current?.focus();
  }

  function triggerFixError() {
    setDraft((prev) => {
      const template = "I'm encountering this error in my circuit or Arduino code: \n";
      return prev ? `${prev}\n${template}` : template;
    });
    textareaRef.current?.focus();
  }

  function triggerExplainCircuit() {
    void send(
      undefined,
      "Can you explain how this circuit works, how the current flows, and what each component is doing?",
    );
  }

  // Toggle wide/compact mode
  function toggleExpand() {
    const nextWide = !isWide;
    setIsWide(nextWide);
    if (pipWindow && typeof pipWindow.resizeTo === "function") {
      try {
        pipWindow.resizeTo(nextWide ? 560 : 400, pipWindow.innerHeight || 640);
      } catch {}
    }
  }

  return (
    <div
      className={`floating-ohmi-window ${isPip ? "pip-mode" : "in-app"} ${
        isWide ? "wide" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      role="region"
      aria-label="Floating OHMI Companion"
    >
      {/* Header bar */}
      <header className="floating-ohmi-header">
        <div className="floating-ohmi-brand">
          <div className="floating-ohmi-avatar-squircle">
            <Image
              src="/app/mascot.png"
              width={26}
              height={30}
              alt="OHMI"
              className="mascot"
              unoptimized
            />
          </div>
          <div className="floating-ohmi-brand-text">
            <span className="floating-ohmi-brand-title">OHMI</span>
            <span className="floating-ohmi-brand-sub">
              <span className="floating-ohmi-status-dot" aria-hidden="true" />
              <span>Your circuit buddy</span>
            </span>
          </div>
        </div>

        <div className="floating-ohmi-header-actions">
          <button
            type="button"
            className={`floating-ohmi-icon-btn ${historyOpen ? "active" : ""}`}
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-label="Conversation history"
            title="Conversation history"
          >
            <History size={16} />
          </button>

          <button
            type="button"
            className="floating-ohmi-icon-btn"
            onClick={toggleExpand}
            aria-label={isWide ? "Standard view" : "Expand view"}
            title={isWide ? "Standard view" : "Expand view"}
          >
            {isWide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {onMinimize && (
            <button
              type="button"
              className="floating-ohmi-icon-btn"
              onClick={onMinimize}
              aria-label="Minimize companion"
              title="Minimize companion"
            >
              <Minus size={16} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="floating-ohmi-icon-btn"
              onClick={onClose}
              aria-label="Close companion"
              title="Close companion"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* History Drawer Overlay */}
      {historyOpen && (
        <div className="floating-ohmi-drawer" role="dialog" aria-label="Conversation history">
          <div className="floating-ohmi-drawer-header">
            <h3>Your Conversations</h3>
            <button
              type="button"
              className="floating-ohmi-new-chat-btn"
              onClick={newChat}
            >
              <Plus size={14} />
              <span>New chat</span>
            </button>
          </div>

          <div className="floating-ohmi-drawer-list">
            {app.conversations.length === 0 ? (
              <p className="text-xs text-neutral-400 p-3 text-center">
                No saved conversations yet.
              </p>
            ) : (
              app.conversations.map((c) => (
                <div
                  key={c.id}
                  className={`floating-ohmi-drawer-item ${
                    c.id === conversation.id ? "active" : ""
                  }`}
                  onClick={() => {
                    request.current?.abort();
                    sequence.current++;
                    setPending(false);
                    submitting.current = false;
                    setOptimisticUser(null);
                    app.setActiveChat(c.id);
                    setHistoryOpen(false);
                  }}
                >
                  <div className="floating-ohmi-drawer-item-title">
                    {c.id === conversation.id && <Check size={14} className="text-teal-400" />}
                    <span>{c.title}</span>
                  </div>
                  <button
                    type="button"
                    className="floating-ohmi-drawer-del-btn"
                    aria-label={`Delete ${c.title}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Delete this conversation?")) return;
                      try {
                        await app.deleteConversation(c.id);
                      } catch {
                        setError("Could not delete conversation.");
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="floating-ohmi-pill-btn text-center justify-center mt-2"
            onClick={() => setHistoryOpen(false)}
          >
            Close History
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div
        className="floating-ohmi-messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        {/* Minimal Empty State (Replaces oversized welcome panel, disappears when chatting begins) */}
        {conversation.messages.length === 0 && !optimisticUser && (
          <div className="floating-ohmi-empty-state" data-testid="welcome-card">
            <div className="floating-ohmi-empty-mascot-wrap">
              <Image
                src="/app/mascot.png"
                width={38}
                height={44}
                alt="OHMI"
                className="floating-ohmi-welcome-mascot mascot"
                unoptimized
              />
            </div>
            <div className="floating-ohmi-welcome-text">
              <h4>Working on a circuit?</h4>
              <p>
                Ask me anything, send a screenshot, or paste your Arduino code. I'll
                help right here!
              </p>
            </div>

            {/* Quick Context Action Pills (Section 3) */}
            <div className="floating-ohmi-quick-actions" data-testid="quick-actions">
              <button
                type="button"
                className="floating-ohmi-pill-btn"
                onClick={triggerCheckWiring}
                title="Analyze uploaded circuit screenshot"
              >
                <Camera size={13} className="quick-action-icon" />
                <span>Circuit screenshot</span>
              </button>

              <button
                type="button"
                className="floating-ohmi-pill-btn"
                onClick={triggerCheckCode}
                title="Debug Arduino sketch code"
              >
                <Code size={13} className="quick-action-icon" />
                <span>Check code</span>
              </button>

              <button
                type="button"
                className="floating-ohmi-pill-btn"
                onClick={triggerFixError}
                title="Troubleshoot circuit errors"
              >
                <Wrench size={13} className="quick-action-icon" />
                <span>Fix my error</span>
              </button>

              <button
                type="button"
                className="floating-ohmi-pill-btn"
                onClick={triggerExplainCircuit}
                title="Explain components and current flow"
              >
                <HelpCircle size={13} className="quick-action-icon" />
                <span>Explain circuit</span>
              </button>

              {/* Workspace platform selector */}
              <div className="floating-ohmi-context-select" title="Active electronics workspace">
                <span>Env:</span>
                <select
                  value={context}
                  onChange={(e) => setContext(e.target.value as WorkspaceContext)}
                  aria-label="Target workspace environment"
                >
                  <option value="Tinkercad Circuits">Tinkercad</option>
                  <option value="Arduino IDE">Arduino IDE</option>
                  <option value="CircuitVerse">CircuitVerse</option>
                  <option value="General Electronics">General</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {conversation.messages.map((message, idx) => {
          const prevUser = conversation.messages
            .slice(0, idx)
            .reverse()
            .find((m) => m.role === "user");

          const circuitIntent =
            prevUser && message.role === "assistant"
              ? parseCircuitIntent(prevUser.text)
              : null;

          const isCircuitMatch =
            message.role === "assistant" &&
            Boolean(circuitIntent?.isCircuitRequest);

          let dynamicCircuit: GeneratedCircuit | null = null;
          if (isCircuitMatch && circuitIntent) {
            try {
              dynamicCircuit = generateCircuit(circuitIntent);
            } catch {}
          }

          const assistantText = message.text.replace(
            /\n*\[Answer incomplete:[^\]]+\]\s*$/,
            "",
          );

          if (message.role === "user") {
            return (
              <div key={message.id} className="floating-ohmi-msg-user">
                <p className="user-text m-0">{message.text}</p>
                {message.attachment && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-teal-200 opacity-90">
                    <Paperclip size={11} />
                    <span>{message.attachment}</span>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={message.id} className="floating-ohmi-msg-assistant">
              <div className="floating-ohmi-bot-avatar" aria-hidden="true">
                <Image
                  src="/app/mascot.png"
                  width={18}
                  height={21}
                  alt=""
                  className="mascot"
                  unoptimized
                />
              </div>

              <div className="floating-ohmi-bubble">
                <RichText text={assistantText} />

                {/* Direct to Playground Action Card */}
                {isCircuitMatch && dynamicCircuit && (
                  <div className="mt-3">
                    <CircuitActionCard
                      circuit={dynamicCircuit}
                      onDirectToPlayground={() =>
                        handleDirectToPlayground(dynamicCircuit)
                      }
                    />
                  </div>
                )}

                {/* Incomplete Continuation button */}
                {message.structured?.incomplete === true &&
                  message.id === conversation.messages.at(-1)?.id && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">
                        Explanation paused at length limit
                      </span>
                      <button
                        type="button"
                        className="floating-ohmi-pill-btn text-teal-300 py-1 px-2.5 text-xs"
                        disabled={pending}
                        onClick={() =>
                          void send(
                            undefined,
                            "Continue the explanation from where it stopped. Preserve formulas, wiring, and code context.",
                            message.structured?.continuation as Record<string, unknown>,
                          )
                        }
                      >
                        <span>Continue</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {/* Optimistic User Message */}
        {optimisticUser && (
          <div
            className={`floating-ohmi-msg-user ${
              optimisticUser.status === "failed" ? "failed" : ""
            }`}
          >
            <p className="user-text m-0">{optimisticUser.text}</p>
            {optimisticUser.attachment && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-teal-200">
                <Paperclip size={11} />
                <span>{optimisticUser.attachment}</span>
              </div>
            )}
            <div className="floating-ohmi-delivery-status">
              {optimisticUser.status === "pending" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <AlertCircle size={11} className="text-red-400" />
                  <span className="text-red-400">Not delivered</span>
                  <button
                    type="button"
                    className="ml-2 text-xs text-teal-300 underline"
                    onClick={() => {
                      const txt = optimisticUser.text;
                      setOptimisticUser(null);
                      void send(undefined, txt, undefined, lastAttachment.current);
                    }}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {pending && (
          <div className="floating-ohmi-typing" role="status" aria-label="OHMI is thinking">
            <div className="floating-ohmi-bot-avatar">
              <Image
                src="/app/mascot.png"
                width={18}
                height={21}
                alt=""
                className="mascot"
                unoptimized
              />
            </div>
            <div className="floating-ohmi-typing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Guest notice if signed out */}
      {!app.user && (
        <div className="mx-3.5 mb-2 p-2 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-between text-xs">
          <span className="text-neutral-300">Sign in to save chats & ask OHMI.</span>
          <button
            type="button"
            className="floating-ohmi-pill-btn py-1 px-3 bg-teal-600 text-white font-semibold"
            onClick={() => void app.signIn()}
          >
            <LogIn size={12} />
            <span>Sign in</span>
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="mx-3.5 mb-2 px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            className="text-red-300 hover:text-white"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Expandable Quick Actions Menu during active conversation */}
      {conversation.messages.length > 0 && quickActionsOpen && (
        <div className="floating-ohmi-quick-menu">
          <div className="floating-ohmi-quick-menu-header">
            <span>Quick actions</span>
            <button
              type="button"
              className="floating-ohmi-icon-btn p-1"
              onClick={() => setQuickActionsOpen(false)}
              aria-label="Close quick actions"
            >
              <X size={12} />
            </button>
          </div>
          <div className="floating-ohmi-quick-menu-pills">
            <button
              type="button"
              className="floating-ohmi-pill-btn"
              onClick={() => {
                triggerCheckWiring();
                setQuickActionsOpen(false);
              }}
              title="Analyze uploaded circuit screenshot"
            >
              <Camera size={12} className="quick-action-icon" />
              <span>Circuit screenshot</span>
            </button>
            <button
              type="button"
              className="floating-ohmi-pill-btn"
              onClick={() => {
                triggerCheckCode();
                setQuickActionsOpen(false);
              }}
              title="Debug Arduino sketch code"
            >
              <Code size={12} className="quick-action-icon" />
              <span>Check code</span>
            </button>
            <button
              type="button"
              className="floating-ohmi-pill-btn"
              onClick={() => {
                triggerFixError();
                setQuickActionsOpen(false);
              }}
              title="Troubleshoot circuit errors"
            >
              <Wrench size={12} className="quick-action-icon" />
              <span>Fix my error</span>
            </button>
            <button
              type="button"
              className="floating-ohmi-pill-btn"
              onClick={() => {
                triggerExplainCircuit();
                setQuickActionsOpen(false);
              }}
              title="Explain components and current flow"
            >
              <HelpCircle size={12} className="quick-action-icon" />
              <span>Explain circuit</span>
            </button>
          </div>
        </div>
      )}

      {/* Chat Composer (Matches Reference Design) */}
      <form
        onSubmit={send}
        className={`floating-ohmi-composer ${isDraggingOver ? "drag-over" : ""}`}
        aria-busy={pending}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask OHMI anything…"
          className="floating-ohmi-textarea"
          rows={1}
          maxLength={3000}
          aria-label="Ask OHMI anything"
        />

        {/* Attachment chip */}
        {attachment && (
          <div className="floating-ohmi-attachment-chip">
            <Paperclip size={12} className="text-teal-600 dark:text-teal-400" />
            <span>{attachment.name}</span>
            <button
              type="button"
              className="floating-ohmi-attachment-remove"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="floating-ohmi-toolbar">
          <div className="floating-ohmi-toolbar-left">
            <button
              type="button"
              className="floating-ohmi-tool-btn"
              onClick={() => fileRef.current?.click()}
              aria-label="Upload circuit screenshot or assignment"
              title="Attach screenshot or diagram"
            >
              <Camera size={15} />
            </button>

            <button
              type="button"
              className="floating-ohmi-tool-btn"
              onClick={() => codeFileRef.current?.click()}
              aria-label="Upload Arduino code file"
              title="Attach Arduino sketch (.ino, .cpp)"
            >
              <Code size={15} />
            </button>

            <button
              type="button"
              className="floating-ohmi-tool-btn"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach document or PDF"
              title="Attach PDF or image"
            >
              <FileText size={15} />
            </button>

            {conversation.messages.length > 0 && (
              <button
                type="button"
                className={`floating-ohmi-tool-btn ${quickActionsOpen ? "active" : ""}`}
                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                aria-label="Quick actions"
                title="Quick troubleshooting actions"
              >
                <Sparkles size={14} />
              </button>
            )}

            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              {context === "Tinkercad Circuits"
                ? "Tinkercad"
                : context === "Arduino IDE"
                  ? "Arduino"
                  : context === "CircuitVerse"
                    ? "CircuitVerse"
                    : "Electronics"}
            </span>
          </div>

          <div>
            {pending ? (
              <button
                type="button"
                className="floating-ohmi-stop-btn"
                onClick={stop}
                aria-label="Stop waiting for answer"
              >
                <Square size={9} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                className="floating-ohmi-send-btn"
                disabled={!draft.trim() || !app.user || Boolean(conversation.id && !conversation.loaded)}
                aria-label="Send message"
                title={
                  !draft.trim()
                    ? "Enter a question first"
                    : !app.user
                      ? "Sign in to send"
                      : "Send question to OHMI"
                }
              >
                <ArrowUp size={15} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const problem = validateFile(file);
              setError(problem || "");
              if (!problem) setAttachment(file);
            }
            e.target.value = "";
          }}
        />

        <input
          ref={codeFileRef}
          type="file"
          accept=".ino,.cpp,.c,.h,.txt"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void handleCodeFile(file);
            }
            e.target.value = "";
          }}
        />
      </form>
    </div>
  );
}
