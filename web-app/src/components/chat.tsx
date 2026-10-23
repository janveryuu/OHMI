"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
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
import { demoReply, starterMessages } from "@/lib/content";
import { validateFile } from "@/lib/demo.mjs";

export function Chat() {
  const app = useApp(),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState(false),
    [expanded, setExpanded] = useState(false),
    [history, setHistory] = useState(false),
    [attachment, setAttachment] = useState<File | null>(null),
    [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    fileRef = useRef<HTMLInputElement>(null),
    messagesRef = useRef<HTMLDivElement>(null);
  const conversation =
    app.conversations.find((c) => c.id === app.activeChat) ||
    app.conversations[0];
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.messages.length, pending]);
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    setPending(false);
  }
  function newChat() {
    stop();
    const id = crypto.randomUUID();
    const chat: Conversation = {
      id,
      title: "New conversation",
      messages: starterMessages,
    };
    app.setConversations((prev) => [chat, ...prev]);
    app.setActiveChat(id);
    setDraft("");
    setAttachment(null);
    setHistory(false);
  }
  function send(event?: FormEvent, text = draft) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || pending) return;
    const id = conversation.id;
    const attachmentName = attachment?.name;
    app.setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              title: c.messages.length === 1 ? value.slice(0, 48) : c.title,
              messages: [
                ...c.messages,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  text: value,
                  attachment: attachmentName,
                },
              ],
            }
          : c,
      ),
    );
    setDraft("");
    setAttachment(null);
    setPending(true);
    setError("");
    timer.current = setTimeout(() => {
      app.setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    text:
                      demoReply(value, app.language) +
                      (attachmentName
                        ? "\n\nYour attachment was selected locally. This demo has not read or analyzed it."
                        : ""),
                  },
                ],
              }
            : c,
        ),
      );
      setPending(false);
    }, 950);
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
                src="/mascot.png"
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
          <span className="badge">Preset demo</span>
        </div>
        <div
          className="chat-messages"
          ref={messagesRef}
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
        >
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
                </div>
                {message.role === "assistant" ? (
                  <RichText text={message.text} />
                ) : (
                  <p className="user-text">{message.text}</p>
                )}
                {message.attachment && (
                  <span className="message-attachment">
                    <File size={14} />
                    {message.attachment}
                  </span>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
          {pending && (
            <div className="message assistant skeleton" role="status">
              <span className="sr-only">Preparing preset response…</span>
              <span />
              <span />
              <span />
            </div>
          )}
          {conversation.messages.length === 1 && (
            <div className="chat-suggestions">
              <Sparkles size={24} />
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
        <div className="chat-compose">
          <form onSubmit={send}>
            <label htmlFor="message" className="sr-only">
              Your question
            </label>
            <textarea
              id="message"
              name="message"
              className="input"
              rows={2}
              maxLength={4000}
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
                  aria-label="Attach local file"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={19} />
                </Button>
                <span className="small muted">
                  {app.language}{" "}
                  <ChevronDown size={12} className="inline-icon" />
                </span>
              </div>
              {pending ? (
                <Button type="button" variant="outline" onClick={stop}>
                  Stop demo
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!draft.trim()}
                >
                  <ArrowUp size={20} />
                </Button>
              )}
            </div>
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
            Frontend demo. Preset replies only. Files stay local and are not
            analyzed.
          </p>
        </div>
      </section>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent>
          <DialogTitle>Your conversations</DialogTitle>
          <DialogDescription>
            Kept in this session only. Refreshing clears the history.
          </DialogDescription>
          <Button onClick={newChat}>
            <Plus size={16} />
            New chat
          </Button>
          <div className="history-list">
            {app.conversations.map((c) => (
              <button
                key={c.id}
                className="more-link"
                onClick={() => {
                  stop();
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
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
