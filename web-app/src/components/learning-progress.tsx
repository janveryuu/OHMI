"use client";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Flag,
  FolderOpen,
  Lightbulb,
  MessageCircle,
  Trophy,
} from "lucide-react";
import { useApp } from "./app-provider";
import { steps } from "@/lib/content";
import { lessonProgress } from "@/lib/demo.mjs";
import { Button } from "./ui/button";
import { LoadingSkeleton } from "./ui/loading-skeleton";
export function LearningProgress() {
  const app = useApp(),
    done = app.completed.filter(Boolean).length,
    progress = lessonProgress(app.completed),
    questions = app.conversations.reduce(
      (sum, c) => sum + c.messages.filter((m) => m.role === "user").length,
      0,
    );
  const achievements = [
    {
      title: "First connection",
      description: "Complete your first guide step.",
      earned: done > 0,
      icon: ZapIcon,
    },
    {
      title: "Curious mind",
      description: "Ask a question in your saved conversations.",
      earned: questions > 0,
      icon: Lightbulb,
    },
    {
      title: "Little light, big win",
      description: "Complete all five LED guide steps.",
      earned: done === 5,
      icon: Trophy,
    },
  ];
  return (
    <div className="stack">
      <div className="page-heading">
        <h1>Look how far you’re going.</h1>
        <p>Every small connection counts. Here’s your learning story.</p>
      </div>
      <div className="notice">
        Account progress records your completed guide steps. It does not measure
        electrical knowledge.
      </div>
      <section className="progress-overview panel">
        <div>
          <span className="icon-tile">
            <BookOpen size={23} />
          </span>
          <h2>Your first LED circuit</h2>
          <p className="muted">
            {done === 5
              ? "You followed every step. Keep that curiosity going."
              : "Build at your own pace. Understanding takes practice."}
          </p>
          <Button asChild>
            <Link href="/guide">
              {done ? "Continue learning" : "Start learning"}
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <div className="progress-summary">
          <strong>
            {progress}
            <span>%</span>
          </strong>
          <p>{done} of 5 steps complete</p>
          <progress
            value={progress}
            max="100"
            aria-label="Overall lesson progress"
          />
        </div>
      </section>
      <div className="session-stats">
        <div>
          <MessageCircle size={21} />
          {app.loading ? (
            <LoadingSkeleton variant="text" width={40} height={20} className="my-1" ariaLabel="Loading questions count" />
          ) : (
            <strong>{questions}</strong>
          )}
          <span>Questions explored</span>
        </div>
        <div>
          <FolderOpen size={21} />
          {app.loading ? (
            <LoadingSkeleton variant="text" width={40} height={20} className="my-1" ariaLabel="Loading materials count" />
          ) : (
            <strong>{app.files.length}</strong>
          )}
          <span>Private materials</span>
        </div>
        <div>
          <Flag size={21} />
          {app.loading ? (
            <LoadingSkeleton variant="text" width={40} height={20} className="my-1" ariaLabel="Loading lessons count" />
          ) : (
            <strong>{done === 5 ? 1 : 0}</strong>
          )}
          <span>Lessons completed</span>
        </div>
      </div>
      <section className="panel">
        <h2 className="section-title">Little wins, worth celebrating.</h2>
        <div className="achievement-grid">
          {achievements.map((item) => (
            <div
              className={`achievement ${item.earned ? "earned" : ""}`}
              key={item.title}
            >
              <span className="achievement-icon">
                <item.icon size={28} strokeWidth={1.4} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="small">
                {item.earned ? "Earned" : "Ready to discover"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-title between">
          <h2>Your lesson milestones</h2>
          <span className="small muted">Saved guide</span>
        </div>
        <div className="milestone-list">
          {steps.map((step, index) => (
            <div key={step.title}>
              <span
                className={`milestone-check ${app.completed[index] ? "done" : ""}`}
              >
                {app.completed[index] ? <Check size={16} /> : index + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p className="small muted">
                  {app.completed[index]
                    ? "Marked complete by you"
                    : "Not completed yet"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function ZapIcon() {
  return <Lightbulb size={18} aria-hidden="true" />;
}
