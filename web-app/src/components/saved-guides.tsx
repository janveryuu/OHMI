"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { RichText } from "./rich-text";
import {
  completeSketchMarkdown,
  guideNeedsDetails,
} from "@/lib/backend/guards.mjs";
import { askBackend } from "@/lib/backend/ai";
export function SavedGuides() {
  const app = useApp(),
    [goal, setGoal] = useState(""),
    [assignment, setAssignment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const sequence = useRef(0),
    request = useRef<AbortController | null>(null),
    retry = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    sequence.current++;
    request.current?.abort();
    setGoal("");
    setFeedback(null);
    setAssignment("");
    setError("");
    setBusy(false);
    retry.current = null;
    return () => {
      sequence.current++;
      request.current?.abort();
    };
  }, [app.user?.id]);
  async function generate() {
    if (!app.user || !goal.trim() || busy) return;
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
      const key = JSON.stringify(payload),
        requestId =
          retry.current?.key === key ? retry.current.id : crypto.randomUUID();
      retry.current = { key, id: requestId };
      const response = await askBackend(
        { ...payload, requestId },
        controller.signal,
      );
      if (current !== sequence.current) return;
      if (guideNeedsDetails(response.result)) {
        setFeedback(response.result);
        retry.current = null;
        return;
      }
      setFeedback(null);
      await app.refresh();
      setGoal("");
      retry.current = null;
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
            : "Guide could not be generated.",
        );
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }
  const saved = app.analyses.filter(
    (a) => a.artifact_kind === "tutorial" && a.model !== "ohmi-curated-led-v1",
  );
  return (
    <section className="panel stack">
      <h2>Your assignment guides</h2>
      <p className="muted">
        Generate a guide from your materials or describe a circuit to learn. AI
        may ask for missing details.
      </p>
      <label className="field">
        Learning goal
        <textarea
          className="input"
          maxLength={2000}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <label className="field">
        Private material (optional)
        <select
          className="input"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
        >
          <option value="">No material</option>
          {app.files
            .filter((f) => f.status === "ready")
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </label>
      <Button disabled={!app.user || busy || !goal.trim()} onClick={generate}>
        {busy ? "Generating and saving…" : "Generate guide"}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <div className="notice">
          <p>
            OHMI needs more detail or cannot build this guide. No complete guide
            was saved.
          </p>
          <RichText
            text={[feedback.answer, feedback.notes]
              .filter((v) => typeof v === "string")
              .join("\n\n")}
          />
          {Array.isArray(feedback.clarificationQuestions) &&
            feedback.clarificationQuestions.map((q, i) => (
              <p key={i}>{typeof q === "string" ? q : ""}</p>
            ))}
        </div>
      )}
      {saved.map((a) => (
        <SavedGuide key={a.id} analysis={a} />
      ))}
    </section>
  );
}
function SavedGuide({
  analysis,
}: {
  analysis: ReturnType<typeof useApp>["analyses"][number];
}) {
  const app = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const value = analysis.payload,
    progress = app.savedProgress.find((p) => p.analysis_id === analysis.id);
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return (
    <details>
      <summary>{analysis.title || text(value.title) || "Saved guide"}</summary>
      <RichText
        text={[value.objective, value.answer, value.notes]
          .map(text)
          .filter(Boolean)
          .join("\n\n")}
      />
      <RichText text={completeSketchMarkdown(value)} />
      {Array.isArray(value.components) && (
        <ul>
          {value.components.map((c: Record<string, unknown>, i: number) => (
            <li key={i}>
              {String(c.quantity || "")} {text(c.name)} {text(c.notes)}
            </li>
          ))}
        </ul>
      )}
      {steps.map((step: Record<string, unknown>, index: number) => (
        <section key={index} className="stack-sm">
          <h3>
            Step {index + 1}: {text(step.title)}
          </h3>
          <RichText
            text={[
              step.instruction,
              step.why,
              step.check,
              step.code ? "```cpp\n" + text(step.code) + "\n```" : "",
            ]
              .map(text)
              .join("\n\n")}
          />
          <label className="complete-step">
            <input
              type="checkbox"
              disabled={busy}
              checked={progress?.completed.includes(index) || false}
              onChange={async (e) => {
                const done = e.target.checked;
                setBusy(true);
                setError("");
                try {
                  const completed = new Set(progress?.completed || []);
                  if (done) completed.add(index);
                  else completed.delete(index);
                  await app.saveProgress(
                    analysis.id,
                    index,
                    [...completed].sort((a, b) => a - b),
                  );
                } catch {
                  setError("Progress could not be saved. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            />
            I completed this step.
          </label>
        </section>
      ))}
      {Array.isArray(value.clarificationQuestions) &&
        value.clarificationQuestions.map((q, i) => <p key={i}>{text(q)}</p>)}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
