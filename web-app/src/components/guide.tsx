"use client";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Code,
  FileText,
  Lightbulb,
  Plus,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { steps as defaultSteps } from "@/lib/content";
import { lessonProgress } from "@/lib/demo.mjs";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { GuideGenerator } from "./saved-guides";
import { StepVisual } from "./circuit-diagram";
import { RichText } from "./rich-text";

export function Guide() {
  const app = useApp(),
    [activeGuideId, setActiveGuideId] = useState<string>("led"),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [touch, setTouch] = useState<number | null>(null),
    [showGenerator, setShowGenerator] = useState(false),
    reduced = useReducedMotion();

  // Filter saved assignment tutorials
  const savedGuides = app.analyses.filter(
    (a) => a.artifact_kind === "tutorial" && a.model !== "ohmi-curated-led-v1",
  );

  const isCuratedLed = activeGuideId === "led";
  const activeAnalysis = isCuratedLed
    ? null
    : savedGuides.find((g) => g.id === activeGuideId) || savedGuides[0] || null;

  // Active guide properties
  let title = "A little light. A big first step.";
  let subtitle = "Build your first LED circuit, one connection at a time.";
  let timeEstimate = "About 10 minutes";
  let badgeLabel = "Beginner";

  interface GuideStepItem {
    title: string;
    detail: string;
    tip: string;
    check?: string;
    code?: string;
    task: string;
  }

  let guideSteps: GuideStepItem[] = defaultSteps.map((s) => ({
    title: s.title,
    detail: s.detail,
    tip: s.tip,
    task: s.task,
  }));

  let buildingBlocks: string[] = [
    "1 red LED",
    "1 × 330 Ω resistor",
    "Breadboard",
    "Jumper wires",
    "5 V DC source",
  ];

  let completedCount = app.completed.filter(Boolean).length;
  let progressPercent = lessonProgress(app.completed);
  let activePayload: Record<string, unknown> | null = null;

  if (!isCuratedLed && activeAnalysis) {
    activePayload = (activeAnalysis.payload || {}) as Record<string, unknown>;
    title =
      activeAnalysis.title ||
      (typeof activePayload.title === "string" ? activePayload.title : "") ||
      "Assignment Circuit Guide";
    subtitle =
      (typeof activePayload.objective === "string"
        ? activePayload.objective
        : "") || "Follow the step-by-step path below to build and test your circuit.";
    badgeLabel = "Assignment";

    const rawSteps = Array.isArray(activePayload.steps)
      ? activePayload.steps
      : [];
    if (rawSteps.length > 0) {
      guideSteps = rawSteps.map((s: Record<string, unknown>, idx: number) => {
        const stepNum = typeof s.step === "number" ? s.step : idx + 1;
        const sTitle =
          typeof s.title === "string" && s.title.trim()
            ? s.title.trim()
            : typeof s.instruction === "string" && s.instruction.length > 0
              ? s.instruction.split(/[.\n]/)[0].slice(0, 45)
              : `Step ${stepNum}`;
        return {
          title: sTitle,
          detail: typeof s.instruction === "string" ? s.instruction : "",
          tip: typeof s.why === "string" ? s.why : "",
          check: typeof s.check === "string" ? s.check : "",
          code: typeof s.code === "string" ? s.code : "",
          task: `I completed step ${stepNum}.`,
        };
      });
    }

    timeEstimate = `About ${Math.max(5, guideSteps.length * 3)} minutes`;

    if (Array.isArray(activePayload.components) && activePayload.components.length > 0) {
      buildingBlocks = activePayload.components.map(
        (c: Record<string, unknown>) => {
          const qty = c.quantity ? `${c.quantity} × ` : "";
          const name = typeof c.name === "string" ? c.name : "Component";
          const notes = typeof c.notes === "string" ? ` (${c.notes})` : "";
          return `${qty}${name}${notes}`;
        },
      );
    }

    const savedProgress = app.savedProgress.find(
      (p) => p.analysis_id === activeAnalysis.id,
    );
    const completedIndices = new Set(savedProgress?.completed || []);
    completedCount = completedIndices.size;
    progressPercent =
      guideSteps.length > 0
        ? Math.round((completedCount / guideSteps.length) * 100)
        : 0;
  }

  const current = guideSteps[step] || guideSteps[0];

  function move(next: number) {
    setStep(Math.max(0, Math.min(guideSteps.length - 1, next)));
  }

  function selectGuide(id: string) {
    setActiveGuideId(id);
    if (id === "led") {
      setStep(0);
    } else {
      const prog = app.savedProgress.find((p) => p.analysis_id === id);
      setStep(
        prog && typeof prog.current_step === "number"
          ? Math.max(0, Math.min(guideSteps.length - 1, prog.current_step))
          : 0,
      );
    }
    setError("");
  }

  const isCurrentStepDone = isCuratedLed
    ? Boolean(app.completed[step])
    : Boolean(
        activeAnalysis &&
          app.savedProgress
            .find((p) => p.analysis_id === activeAnalysis.id)
            ?.completed.includes(step),
      );

  return (
    <div className="stack">
      {/* Guide Switcher Tabs */}
      <div className="guide-switcher-bar">
        <div className="guide-pills" role="tablist" aria-label="Available Guides">
          <button
            role="tab"
            aria-selected={isCuratedLed}
            className={`guide-pill ${isCuratedLed ? "active" : ""}`}
            onClick={() => selectGuide("led")}
          >
            <span>💡</span>
            <span>Beginner LED</span>
          </button>
          {savedGuides.map((g) => {
            const isSelected = activeGuideId === g.id;
            const shortTitle =
              g.title ||
              (g.payload && typeof g.payload.title === "string"
                ? g.payload.title
                : "") ||
              "Assignment Guide";
            return (
              <button
                key={g.id}
                role="tab"
                aria-selected={isSelected}
                className={`guide-pill ${isSelected ? "active" : ""}`}
                onClick={() => selectGuide(g.id)}
              >
                <BookOpen size={14} />
                <span>{shortTitle}</span>
              </button>
            );
          })}
          <button
            className={`guide-pill new-guide-pill ${showGenerator ? "active" : ""}`}
            onClick={() => setShowGenerator((v) => !v)}
            aria-label="Generate new guide from assignment"
          >
            <Plus size={14} />
            <span>Generate Guide</span>
          </button>
        </div>
      </div>

      {/* Collapsible Assignment Guide Generator */}
      {showGenerator && (
        <GuideGenerator
          onCreated={(newId) => {
            setShowGenerator(false);
            selectGuide(newId);
          }}
          onCancel={() => setShowGenerator(false)}
        />
      )}

      {/* Page Heading */}
      <div className="page-heading between">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <span className="row small muted">
          <Clock3 size={16} />
          {timeEstimate}
        </span>
      </div>

      {/* Main Interactive "Your Path" Layout */}
      <div className="guide-layout">
        <aside className="guide-sidebar panel">
          <div className="between">
            <h2>Your path</h2>
            <span className="badge">{badgeLabel}</span>
          </div>
          <div className="lesson-progress">
            <div className="between small">
              <span>
                {completedCount} of {guideSteps.length} complete
              </span>
              <strong>{progressPercent}%</strong>
            </div>
            <progress
              value={progressPercent}
              max="100"
              aria-label="Completed guide steps"
            />
          </div>
          <nav aria-label="Lesson steps" className="guide-steps">
            {guideSteps.map((item, index) => {
              const isDone = isCuratedLed
                ? Boolean(app.completed[index])
                : Boolean(
                    activeAnalysis &&
                      app.savedProgress
                        .find((p) => p.analysis_id === activeAnalysis.id)
                        ?.completed.includes(index),
                  );
              return (
                <button
                  key={index}
                  onClick={() => move(index)}
                  className={step === index ? "current" : ""}
                  aria-current={step === index ? "step" : undefined}
                >
                  <span className="step-number">
                    {isDone ? <Check size={16} /> : index + 1}
                  </span>
                  <span>{item.title}</span>
                </button>
              );
            })}
          </nav>
          <div className="separator" />
          <h3 className="materials-title">Your building blocks</h3>
          <ul className="materials-list">
            {buildingBlocks.map((item, idx) => (
              <li key={idx}>
                <Circle size={10} />
                {item}
              </li>
            ))}
          </ul>
          <p className="small muted">
            Suggested components only. Confirm ratings with your instructor.
          </p>
        </aside>

        <section
          className="panel guide-workspace"
          onTouchStart={(e) => setTouch(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch !== null) {
              const delta = e.changedTouches[0].clientX - touch;
              if (Math.abs(delta) > 100) move(step + (delta < 0 ? 1 : -1));
              setTouch(null);
            }
          }}
        >
          <div className="between">
            <span className="badge">
              Step {step + 1} of {guideSteps.length}
            </span>
            <Zap size={19} className="muted" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeGuideId}-${step}`}
              className="guide-step-content"
              initial={
                reduced || app.reduceMotion ? false : { opacity: 0, x: 12 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                reduced || app.reduceMotion ? undefined : { opacity: 0, x: -8 }
              }
            >
              <h2>{current.title}</h2>
              <div className="guide-detail">
                <RichText text={current.detail} />
              </div>

              {/* Dynamic Step Visual (Schematic or Component Illustration) */}
              <StepVisual
                step={step}
                title={current.title}
                instruction={current.detail}
                why={current.tip}
                check={current.check}
                code={current.code}
                isCuratedLed={isCuratedLed}
              />

              {/* A Little Thing to Know / Why Callout */}
              {current.tip && (
                <div className="guide-tip">
                  <Lightbulb size={21} />
                  <div>
                    <strong>A little thing to know</strong>
                    <RichText text={current.tip} />
                  </div>
                </div>
              )}

              {/* Verification Check & Expected Outcome */}
              {current.check && (
                <div className="guide-checkpoint">
                  <CheckCircle2 size={21} className="guide-check-icon" />
                  <div>
                    <strong>Expected outcome & check</strong>
                    <RichText text={current.check} />
                  </div>
                </div>
              )}

              {/* Step Arduino Code Snippet */}
              {current.code && (
                <div className="guide-code-box">
                  <div className="guide-code-header">
                    <Code size={16} />
                    <span>Arduino Code (Step {step + 1})</span>
                  </div>
                  <pre>
                    <code>{current.code}</code>
                  </pre>
                </div>
              )}

              {/* Full Arduino Sketch Accordion */}
              {!isCuratedLed &&
                activePayload &&
                typeof activePayload.code === "string" &&
                activePayload.code.trim().length > 0 && (
                  <details className="guide-full-sketch">
                    <summary>
                      <Code size={15} />
                      Complete Arduino Sketch
                    </summary>
                    <pre>
                      <code>{activePayload.code}</code>
                    </pre>
                  </details>
                )}

              {/* Completion Checkbox */}
              <label className="complete-step">
                <input
                  type="checkbox"
                  checked={isCurrentStepDone}
                  disabled={busy || !app.user}
                  onChange={async (e) => {
                    const done = e.target.checked;
                    setBusy(true);
                    setError("");
                    try {
                      if (isCuratedLed) {
                        await app.saveGuideStep(step, done);
                      } else if (activeAnalysis) {
                        const savedProg = app.savedProgress.find(
                          (p) => p.analysis_id === activeAnalysis.id,
                        );
                        const completedSet = new Set(
                          savedProg?.completed || [],
                        );
                        if (done) completedSet.add(step);
                        else completedSet.delete(step);
                        await app.saveProgress(
                          activeAnalysis.id,
                          step,
                          [...completedSet].sort((a, b) => a - b),
                        );
                      }
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Progress could not be saved.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <span>{current.task}</span>
              </label>
            </motion.div>
          </AnimatePresence>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <p className="small muted">
            {busy
              ? "Saving progress…"
              : app.user
                ? "Progress is saved to your account after confirmation."
                : "Sign in to save progress. You can browse the guide without an account."}
          </p>

          <div className="guide-controls between">
            <Button
              variant="outline"
              onClick={() => move(step - 1)}
              disabled={step === 0}
            >
              <ArrowLeft size={16} />
              Previous
            </Button>
            {step === guideSteps.length - 1 ? (
              <Button asChild>
                <Link href="/progress">
                  View progress
                  <CheckCircle2 size={16} />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => move(step + 1)}>
                Next step
                <ArrowRight size={16} />
              </Button>
            )}
          </div>

          <p className="small muted guide-swipe-note">
            Use the step list or buttons. On touch screens, swipe to browse.
          </p>
        </section>
      </div>
    </div>
  );
}
