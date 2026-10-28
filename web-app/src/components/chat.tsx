"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  File,
  History,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useApp, type Conversation } from "./app-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { RichText } from "./rich-text";
import { OhmiTypingIndicator } from "./ui/typing-indicator";
import { LoadingSkeleton } from "./ui/loading-skeleton";
import { askBackend } from "@/lib/backend/ai";
import { validateFile } from "@/lib/demo.mjs";

export function Chat() {
  const app = useApp(),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState(false),
    [expanded, setExpanded] = useState(false),
    [history, setHistory] = useState(false),
    [attachment, setAttachment] = useState<File | null>(null),
    [error, setError] = useState(""),
    [optimisticUser, setOptimisticUser] = useState<{
      id: string;
      text: string;
      attachment?: string;
      status: "pending" | "failed";
      error?: string;
    } | null>(null);
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0),
    retry = useRef<{ key: string; requestId: string } | null>(null),
    uploaded = useRef<{ file: File; id: string } | null>(null),
    fileRef = useRef<HTMLInputElement>(null),
    messagesRef = useRef<HTMLDivElement>(null),
    isNearBottomRef = useRef(true),
    lastSubmittedText = useRef(""),
    lastAttachment = useRef<File | null>(null);
  const conversation = app.conversations.find((c) => c.id === app.activeChat) ||
    app.conversations[0] || { id: "", title: "New conversation", messages: [] };
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  function handleScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 90;
  }
  useEffect(() => {
    const el = messagesRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation.messages.length, pending, optimisticUser]);
  useEffect(() => {
    sequence.current++;
    request.current?.abort();
    setPending(false);
    setDraft("");
    setAttachment(null);
    setOptimisticUser(null);
    setError("");
    uploaded.current = null;
    retry.current = null;
  }, [app.user?.id]);
  function stop() {
    sequence.current++;
    request.current?.abort();
    setPending(false);
    if (optimisticUser) {
      setDraft(optimisticUser.text);
      setOptimisticUser(null);
    }
    setError(
      "Stopped waiting. Your question has been restored to the message box.",
    );
  }
  async function newChat() {
    request.current?.abort();
    sequence.current++;
    setPending(false);
    setOptimisticUser(null);
    setError("");
    try {
      await app.newConversation();
      setDraft("");
      setAttachment(null);
      setHistory(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chat could not be created.",
      );
    }
  }
  async function send(event?: FormEvent, text = draft, continuation?: Record<string, unknown>) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || pending) return;
    if (!app.user) {
      setError("Sign in to ask OHMI and save your conversation.");
      return;
    }
    if (conversation.id && !conversation.loaded) {
      setError(
        "Your saved conversation is loading. Wait or reload the conversation before sending.",
      );
      return;
    }
    const current = ++sequence.current,
      controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");

    if (!continuation) {
      lastSubmittedText.current = value;
      lastAttachment.current = attachment;
      setOptimisticUser({
        id: crypto.randomUUID(),
        text: value,
        attachment: attachment?.name,
        status: "pending",
      });
      setDraft("");
      setAttachment(null);
    }
    isNearBottomRef.current = true;
    setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }, 10);

    try {
      const availability = await fetch("/app/api/ai/", {
        cache: "no-store",
        signal: controller.signal,
      }).then((r) => r.json());
      if (!availability.enabled)
        throw new Error(
          "AI tutoring is currently paused.",
        );
      const id = conversation.id || (await app.newConversation(value));
      if (current !== sequence.current) return;
      let assignmentId = typeof continuation?.assignmentId === "string" ? continuation.assignmentId : undefined;
      const attachedFile = continuation ? null : lastAttachment.current;
      if (attachedFile && !continuation) {
        if (uploaded.current?.file === attachedFile)
          assignmentId = uploaded.current.id;
        else {
          assignmentId = await app.uploadFile(attachedFile);
          uploaded.current = { file: attachedFile, id: assignmentId };
        }
      }
      if (current !== sequence.current) return;
      const operation = continuation ? continuation.operation : attachedFile
        ? attachedFile.type === "application/pdf"
          ? "pdf"
          : "image"
        : "chat";
      const payload = {
        version: 1,
        operation,
        language: app.language.toLowerCase(),
        message: value,
        conversationId: id,
        historyThroughPosition: conversation.messages.at(-1)?.position || 0,
        ...(assignmentId ? { assignmentId } : {}),
        ...(typeof continuation?.circuitAnalysisId === "string" ? { circuitAnalysisId: continuation.circuitAnalysisId } : {}),
      };
      const key = JSON.stringify(payload);
      const requestId =
        retry.current?.key === key
          ? retry.current.requestId
          : crypto.randomUUID();
      retry.current = { key, requestId };
      await askBackend({ ...payload, requestId }, controller.signal);
      if (current !== sequence.current) return;
      await app.refreshConversation(id);
      await app.refresh();
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
      )
        retry.current = null;
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
      if (current === sequence.current) setPending(false);
    }
  }
  return (
    <div className={`chat-page ${expanded ? "chat-expanded" : ""}`}>
      <div className="page-heading between">
        <div>
          <h1>Ask OHMI</h1>
          <p>A safe space for every “wait, why?”</p>
        </div>
        <div className="row">
          <Button
            variant="outline"
            aria-label="Open conversation history"
            onClick={() => setHistory(true)}
          >
            <History size={17} />
            <span className="hide-small">History</span>
          </Button>
          <Button
            variant="outline"
            aria-label={
              expanded
                ? "Restore conversation view"
                : "Expand conversation view"
            }
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </Button>
          <Button onClick={newChat}>
            <Plus size={17} />
            <span className="hide-small">New chat</span>
          </Button>
        </div>
      </div>
      <section className="chat-workspace panel">
        <div className="chat-header between">
          <div className="row">
            <span className="chat-avatar">
              <Image
                className="mascot"
                src="/app/mascot.png"
                alt=""
                width="31"
                height="36"
              />
            </span>
            <div>
              <strong>Your circuit buddy</strong>
              <p className="small muted">
                Patient explanations. One connection at a time.
              </p>
            </div>
          </div>
          <span className="badge">Saved conversations</span>
        </div>
        <div
          className="chat-messages"
          ref={messagesRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
        >
          {conversation.hasOlder && (
            <Button
              variant="outline"
              onClick={() =>
                void app
                  .loadOlder(conversation.id)
                  .catch((error) => setError(error.message))
              }
            >
              Load earlier messages
            </Button>
          )}
          <AnimatePresence initial={false}>
            {conversation.messages.map((message) => (
              <motion.article
                key={message.id}
                className={`message ${message.role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="message-sender">
                  {message.role === "assistant" ? "OHMI" : "You"}
                  {message.role === "assistant" && typeof message.structured?.mode === "string" && (
                    <span className="muted"> · {message.structured.mode === "limited" ? "Limited mode" : message.structured.mode === "local" ? "Local reply" : "AI reply"}</span>
                  )}
                </div>
                {message.role === "assistant" ? (
                  <RichText text={message.text.replace(/\n*\[Answer incomplete:[^\]]+\]\s*$/, "")} />
                ) : (
                  <p className="user-text">{message.text}</p>
                )}
                {message.role === "assistant" && message.structured?.mode === "limited" && message.id === conversation.messages.at(-1)?.id && (
                  <Button variant="outline" disabled={pending} onClick={() => {
                    const original = [...conversation.messages].reverse().find(item => item.role === "user");
                    if (original) void send(undefined, original.text, { operation: "chat" });
                  }}>Retry question</Button>
                )}
                {message.role === "assistant" && message.structured?.incomplete === true && (
                  <div className="incomplete-continuation-card">
                    <div className="incomplete-header">
                      <Sparkles size={14} className="text-primary" />
                      <span>Explanation paused at length limit</span>
                    </div>
                    <p className="incomplete-hint">
                      Continue the answer to see the remaining calculations and steps without repeating completed work.
                    </p>
                    {message.id === conversation.messages.at(-1)?.id && (
                      <Button
                        className="continue-answer-btn"
                        disabled={pending}
                        onClick={() => void send(undefined, "Continue the incomplete explanation from where it stopped. Avoid repeating completed sections; preserve original formulas, units, and attachment context.", message.structured?.continuation as Record<string, unknown>)}
                      >
                        <span>Continue answer</span>
                        <ArrowRight size={14} />
                      </Button>
                    )}
                  </div>
                )}
                {message.attachment && (
                  <span className="message-attachment">
                    <File size={14} />
                    {message.attachment}
                  </span>
                )}
              </motion.article>
            ))}

            {optimisticUser && (
              <motion.article
                key={optimisticUser.id}
                className={`message user ${
                  optimisticUser.status === "failed"
                    ? "failed-message"
                    : "pending-message"
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <div className="message-sender">
                  <span>You</span>
                  <span
                    className={`message-sender-status ${optimisticUser.status}`}
                  >
                    {optimisticUser.status === "pending" ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle
                          size={12}
                          className="text-destructive inline mr-0.5"
                        />
                        <span>Not delivered</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="user-text">{optimisticUser.text}</p>
                {optimisticUser.attachment && (
                  <span className="message-attachment">
                    <File size={14} />
                    {optimisticUser.attachment}
                  </span>
                )}
                {optimisticUser.status === "failed" && (
                  <div className="row gap-2 mt-2 pt-2 border-t border-destructive/25 text-xs">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        setDraft(optimisticUser.text);
                        setOptimisticUser(null);
                        setError("");
                      }}
                    >
                      Restore question
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        const text = optimisticUser.text;
                        setOptimisticUser(null);
                        void send(undefined, text);
                      }}
                    >
                      <RotateCcw size={12} className="mr-1" />
                      Retry
                    </Button>
                  </div>
                )}
              </motion.article>
            )}

            {pending && (
              <motion.article
                key="typing-indicator"
                className="message assistant typing-message"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                role="status"
                aria-live="polite"
              >
                <div className="message-sender">
                  <span>OHMI</span>
                </div>
                <OhmiTypingIndicator message="OHMI is preparing your answer…" />
                <div className="mt-2 pt-2 border-t border-border/40">
                  <LoadingSkeleton
                    variant="text-block"
                    lines={2}
                    ariaLabel="Preparing answer lines"
                  />
                </div>
              </motion.article>
            )}
          </AnimatePresence>
          {conversation.messages.length === 0 && !optimisticUser && !pending && (
            <div className="chat-suggestions">
              <h2>Curiosity looks good on you.</h2>
              <p className="muted">
                Start small. There’s no such thing as a silly question.
              </p>
              <div className="suggestion-options">
                {[
                  "Why does an LED need a resistor?",
                  "Explain Arduino blink code",
                  "Where should I start?",
                ].map((text) => (
                  <Button
                    key={text}
                    variant="outline"
                    onClick={() => send(undefined, text)}
                  >
                    {text}
                    <ArrowUp size={14} />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        {conversation.id && !conversation.loaded && (
          <Button
            variant="outline"
            onClick={() =>
              void app
                .refreshConversation(conversation.id)
                .catch(() =>
                  app.toast("Conversation could not be loaded. Try again."),
                )
            }
          >
            Reload conversation
          </Button>
        )}
        <div className="chat-compose">
          <form onSubmit={send} aria-busy={pending}>
            <label htmlFor="message" className="sr-only">
              Your question
            </label>
            <textarea
              id="message"
              name="message"
              className="input"
              rows={2}
              maxLength={3000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What are you curious about…"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {attachment && (
              <div className="attachment-chip">
                <Paperclip size={14} />
                <span>{attachment.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove attachment"
                  onClick={() => setAttachment(null)}
                >
                  <X size={14} />
                </Button>
              </div>
            )}
            <div className="between compose-toolbar">
              <div className="row">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Attach assignment"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={19} />
                </Button>
                <label className="chat-language">
                  <span className="sr-only">Reply language</span>
                  <select
                    name="reply-language"
                    value={app.language}
                    onChange={(event) =>
                      app.setLanguage(event.currentTarget.value)
                    }
                  >
                    {["English", "Filipino", "Taglish"].map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} aria-hidden="true" />
                </label>
              </div>
              {pending ? (
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Stop waiting for OHMI"
                  onClick={stop}
                >
                  Stop waiting
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  aria-describedby="send-message-description"
                  title={
                    !draft.trim()
                      ? "Enter a question first."
                      : !app.user
                        ? "Sign in to ask OHMI."
                        : conversation.id && !conversation.loaded
                          ? "Wait for the saved conversation to finish loading."
                          : undefined
                  }
                  disabled={
                    !draft.trim() ||
                    !app.user ||
                    Boolean(conversation.id && !conversation.loaded)
                  }
                >
                  <ArrowUp size={20} aria-hidden="true" />
                </Button>
              )}
            </div>
            <span id="send-message-description" className="sr-only">
              {!draft.trim()
                ? "Enter a question to enable sending."
                : !app.user
                  ? "Sign in to ask OHMI."
                  : conversation.id && !conversation.loaded
                    ? "Wait for the saved conversation to finish loading."
                    : "Send your question to OHMI."}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
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
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
          <p className="small muted compose-note">
            Answers use your saved conversation and any assignment you choose to
            upload. Check uncertain wiring against the circuit and simulation.
          </p>
        </div>
      </section>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent>
          <DialogTitle>Your conversations</DialogTitle>
          <DialogDescription>
            Private conversations are saved to your account. Refresh history if
            a request was interrupted.
          </DialogDescription>
          <Button onClick={newChat}>
            <Plus size={16} />
            New chat
          </Button>
          <div className="history-list">
            {app.conversations.map((c) => (
              <div key={c.id} className="row">
                <button
                  key={c.id}
                  className="more-link"
                  onClick={() => {
                    request.current?.abort();
                    sequence.current++;
                    setPending(false);
                    app.setActiveChat(c.id);
                    setDraft("");
                    setAttachment(null);
                    setHistory(false);
                  }}
                >
                  <MessageCircle size={17} />
                  <span>{c.title}</span>
                  {app.activeChat === c.id && <Check size={16} />}
                </button>
                <Button
                  variant="ghost"
                  aria-label={`Delete conversation ${c.title}`}
                  onClick={async () => {
                    if (!confirm("Delete this conversation and its messages?"))
                      return;
                    try {
                      await app.deleteConversation(c.id);
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Deletion failed.",
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
