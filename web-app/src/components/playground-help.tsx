"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { OhmiTypingIndicator } from "./ui/typing-indicator";
import { LoadingSkeleton } from "./ui/loading-skeleton";
import dynamic from "next/dynamic";
const RichText = dynamic(() => import("./rich-text").then(m => m.RichText), { loading: () => <p role="status">Formatting OHMI’s explanation…</p> });
import { useApp } from "./app-provider";
import type { Project } from "@/lib/playground/model";
export function PlaygroundHelp({ project }: { project: Project }) {
  const app = useApp(),
    [question, setQuestion] = useState("Why is my LED not working?"),
    [answer, setAnswer] = useState(""),
    [replyMode, setReplyMode] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const active = useRef(true),
    controller = useRef<AbortController | null>(null),
    retry = useRef<{
      key: string;
      conversationId: string;
      requestId: string;
    } | null>(null),
    generation = useRef(0);
  const signature = JSON.stringify(project);
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setPending(false);
    setAnswer("");
    setError("");
    retry.current = null;
    setReplyMode("");
  }, [signature, app.user?.id]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  async function ask() {
    if (pending || !app.user) return;
    const seq = ++generation.current;
    setPending(true);
    setError("");
    setAnswer("");
    const c = new AbortController();
    controller.current = c;
    try {
      const availability = await fetch("/app/api/ai/", {
        cache: "no-store",
        signal: c.signal,
      }).then((r) => r.json());
      if (!availability.enabled)
        throw new Error(
          "AI tutoring is paused. Deterministic circuit checks and mission hints remain available.",
        );
      const key = signature + "|" + question + "|" + app.language;
      let target = retry.current?.key === key ? retry.current : null;
      if (!target) {
        const id = await app.newConversation("Playground circuit help");
        if (seq !== generation.current || !active.current) return;
        target = { key, conversationId: id, requestId: crypto.randomUUID() };
        retry.current = target;
      }
      const res = await fetch("/app/api/playground/help/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...target,
          project,
          question,
          language: app.language.toLowerCase(),
        }),
        signal: c.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw new Error(
          data.error || "OHMI could not answer. Your circuit is unchanged.",
        );
      if (seq !== generation.current || !active.current) return;
      if (typeof data.result?.answer !== "string")
        throw new Error(
          "OHMI returned no readable explanation. Open Ask OHMI to review saved history.",
        );
      setAnswer(data.result.answer);
      setReplyMode(data.result.mode === "limited" ? "Limited mode" : data.result.mode === "local" ? "Local reply" : "AI reply");
      retry.current = null;
      await app.refresh();
    } catch (e) {
      if (seq === generation.current && active.current)
        setError((e as Error).message);
    } finally {
      if (seq === generation.current && active.current) setPending(false);
    }
  }
  return (
    <details className="pg-context-help">
      <summary>Ask about this circuit</summary>
      <p>
        Shares component settings, terminal connections and the deterministic
        result. AI explains; it cannot change validation.
      </p>
      <label>
        Your question
        <input
          name="playgroundQuestion"
          autoComplete="off"
          maxLength={240}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        disabled={!app.user || pending || !question.trim()}
        onClick={ask}
      >
        <MessageCircle aria-hidden="true" />
        {pending ? "Asking OHMI…" : "Ask OHMI"}
      </Button>
      {pending && (
        <div
          className="p-3.5 rounded-xl border border-border bg-card/60 flex flex-col gap-2 mt-2"
          role="status"
          aria-live="polite"
        >
          <OhmiTypingIndicator message="OHMI is reviewing your circuit workbench…" />
          <div className="mt-1">
            <LoadingSkeleton
              variant="text-block"
              lines={2}
              ariaLabel="Preparing circuit guidance"
            />
          </div>
        </div>
      )}
      {!app.user && (
        <p>
          <Link href="/settings">Sign in</Link> for contextual AI help.
        </p>
      )}
      {error && (
        <p role="alert" className="pg-error">
          {error}
        </p>
      )}
      {answer && (
        <div className="pg-ai-answer">
          <p className="muted">{replyMode}</p>
          <strong>AI guidance, not electrical validation</strong>
          <RichText text={answer} />
          <Link href="/ask">View conversation in Ask OHMI</Link>
        </div>
      )}
    </details>
  );
}
