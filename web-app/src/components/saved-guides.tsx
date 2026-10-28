"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, AlertCircle } from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { LoadingSpinner } from "./ui/loading-spinner";
import { RichText } from "./rich-text";
import { guideNeedsDetails } from "@/lib/backend/guards.mjs";
import { askBackend } from "@/lib/backend/ai";

export interface GuideGeneratorProps {
  onCreated?: (analysisId: string) => void;
  onCancel?: () => void;
}

export function GuideGenerator({ onCreated, onCancel }: GuideGeneratorProps) {
  const app = useApp(),
    [goal, setGoal] = useState(""),
    [assignment, setAssignment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const sequence = useRef(0),
    request = useRef<AbortController | null>(null),
    retry = useRef<{ key: string; id: string } | null>(null),
    submitting = useRef(false);

  useEffect(() => {
    sequence.current++;
    request.current?.abort();
    setGoal("");
    setFeedback(null);
    setAssignment("");
    setError("");
    setBusy(false);
    submitting.current = false;
    retry.current = null;
    return () => {
      sequence.current++;
      request.current?.abort();
    };
  }, [app.user?.id]);

  async function generate() {
    if (!app.user || !goal.trim() || busy || submitting.current) return;
    submitting.current = true;
    const current = ++sequence.current,
      controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const payload = {
        version: 1,
        operation: "tutorial",
        message: goal.trim(),
        language: app.language.toLowerCase(),
        ...(assignment ? { assignmentId: assignment } : {}),
      };
      const key = JSON.stringify(payload);
      const fresh = retry.current?.key !== key;
      const requestId =
        retry.current?.key === key ? retry.current.id : crypto.randomUUID();
      retry.current = { key, id: requestId };
      const response = await askBackend(
        { ...payload, requestId },
        controller.signal,
        { fresh },
      );
      if (current !== sequence.current) return;
      if (guideNeedsDetails(response.result)) {
        setFeedback(response.result);
        retry.current = null;
        return;
      }
      setFeedback(null);

      // Find the created analysis id and switch directly to Your Path
      const resObj =
        typeof response === "object" && response !== null
          ? (response as Record<string, unknown>)
          : null;
      let createdId = "";
      if (resObj) {
        if (typeof resObj.analysisId === "string" && resObj.analysisId) {
          createdId = resObj.analysisId;
        } else if (typeof resObj.resultId === "string" && resObj.resultId) {
          createdId = resObj.resultId;
        } else if (
          resObj.result &&
          typeof resObj.result === "object" &&
          "id" in resObj.result &&
          typeof (resObj.result as Record<string, unknown>).id === "string"
        ) {
          createdId = (resObj.result as Record<string, unknown>).id as string;
        }
      }

      try {
        await app.refresh();
      } catch {
        // Workspace refresh is background synchronization; the guide is already created
      }
      setGoal("");
      retry.current = null;

      if (createdId && onCreated) {
        onCreated(createdId);
      }
    } catch (cause) {
      if (
        cause &&
        typeof cause === "object" &&
        "terminal" in cause &&
        cause.terminal === true
      )
        retry.current = null;
      if (current === sequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Guide could not be generated. Check your connection or materials.",
        );
    } finally {
      submitting.current = false;
      if (current === sequence.current) setBusy(false);
    }
  }

  return (
    <section
      id="guide-generator-panel"
      className="panel stack guide-generator-panel"
      aria-label="Assignment Guide Generator"
    >
      <div className="between">
        <div className="row">
          <Sparkles size={20} className="text-primary" />
          <h3>Generate an Interactive Guide</h3>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Close generator">
            <X size={16} />
          </Button>
        )}
      </div>
      <p className="muted small">
        Describe a circuit or select your uploaded assignment materials. OHMI will turn
        it into an interactive, step-by-step <strong>Your Path</strong> tutorial with visuals,
        checks, and code.
      </p>
      <label className="field">
        Learning goal or circuit description
        <textarea
          className="input"
          placeholder="e.g. Build an Arduino ultrasonic distance alarm with a buzzer and LED..."
          maxLength={2000}
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <label className="field">
        Private assignment material (optional)
        <select
          className="input"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
        >
          <option value="">No material (describe goal above)</option>
          {app.files
            .filter((f) => f.status === "ready")
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </label>
      <div className="row">
        <Button
          disabled={!app.user || busy || !goal.trim()}
          onClick={generate}
        >
          {busy ? "Generating your path…" : "Generate Your Path"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
      {busy && (
        <div
          className="p-3.5 rounded-xl border border-border bg-card/80 flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="sm" variant="primary" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Generating your interactive guide…
            </span>
            <span className="text-[11px] text-muted-foreground">
              OHMI is analyzing learning goals and structuring interactive steps.
            </span>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <div className="notice" role="alert">
          <div className="row">
            <AlertCircle size={18} />
            <strong>OHMI needs a few more details to build this guide safely:</strong>
          </div>
          <RichText
            text={[feedback.answer, feedback.notes]
              .filter((v) => typeof v === "string")
              .join("\n\n")}
          />
          {Array.isArray(feedback.clarificationQuestions) &&
            feedback.clarificationQuestions.map((q, i) => (
              <p key={i}>• {typeof q === "string" ? q : ""}</p>
            ))}
        </div>
      )}
    </section>
  );
}

// Export SavedGuides as an alias/wrapper for backward compatibility
export function SavedGuides({
  onCreated,
  onCancel,
}: GuideGeneratorProps = {}) {
  return <GuideGenerator onCreated={onCreated} onCancel={onCancel} />;
}
