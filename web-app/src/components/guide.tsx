"use client";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Lightbulb,
  RotateCcw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { steps } from "@/lib/content";
import { lessonProgress } from "@/lib/demo.mjs";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { SavedGuides } from "./saved-guides";
import { CircuitDiagram } from "./circuit-diagram";
export function Guide() {
  const app = useApp(),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [touch, setTouch] = useState<number | null>(null),
    reduced = useReducedMotion();
  const current = steps[step],
    progress = lessonProgress(app.completed);
  function move(next: number) {
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
  }
  return (
    <div className="stack">
      <div className="page-heading between">
        <div>
          <h1>A little light. A big first step.</h1>
          <p>Build your first LED circuit, one connection at a time.</p>
        </div>
        <span className="row small muted">
          <Clock3 size={16} />
          About 10 minutes
        </span>
      </div>
      <SavedGuides />
      <div className="guide-layout">
        <aside className="guide-sidebar panel">
          <div className="between">
            <h2>Your path</h2>
            <span className="badge">Beginner</span>
          </div>
          <div className="lesson-progress">
            <div className="between small">
              <span>{app.completed.filter(Boolean).length} of 5 complete</span>
              <strong>{progress}%</strong>
            </div>
            <progress
              value={progress}
              max="100"
              aria-label="Completed guide steps"
            />
          </div>
          <nav aria-label="Lesson steps" className="guide-steps">
            {steps.map((item, index) => (
              <button
                key={item.title}
                onClick={() => move(index)}
                className={step === index ? "current" : ""}
                aria-current={step === index ? "step" : undefined}
              >
                <span className="step-number">
                  {app.completed[index] ? <Check size={16} /> : index + 1}
                </span>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
          <div className="separator" />
          <h3 className="materials-title">Your building blocks</h3>
          <ul className="materials-list">
            {[
              "1 red LED",
              "1 × 330 Ω resistor",
              "Breadboard",
              "Jumper wires",
              "5 V DC source",
            ].map((item) => (
              <li key={item}>
                <Circle size={10} />
                {item}
              </li>
            ))}
          </ul>
          <p className="small muted">
            Example components only. Confirm ratings with your instructor.
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
              Step {step + 1} of {steps.length}
            </span>
            <Zap size={19} className="muted" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
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
              <p className="guide-detail">{current.detail}</p>
              <CircuitDiagram step={step} />
              <div className="guide-tip">
                <Lightbulb size={21} />
                <div>
                  <strong>A little thing to know</strong>
                  <p>{current.tip}</p>
                </div>
              </div>
              <label className="complete-step">
                <input
                  type="checkbox"
                  checked={app.completed[step]}
                  disabled={busy || !app.user}
                  onChange={async (e) => {
                    const done = e.target.checked;
                    setBusy(true);
                    setError("");
                    try {
                      await app.saveGuideStep(step, done);
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
            {step === steps.length - 1 ? (
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
