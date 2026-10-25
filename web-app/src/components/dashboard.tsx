"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircuitBoard,
  FolderOpen,
  Lightbulb,
  MessageCircle,
  Plus,
  ScanLine,
  Zap,
} from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "./app-provider";
import { lessonProgress } from "@/lib/demo.mjs";

export function Dashboard() {
  const app = useApp(),
    progress = lessonProgress(app.completed);
  const count = app.completed.filter(Boolean).length;
  const [reduced, setReduced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const animateMascot = reduced === false && !app.reduceMotion && !failed;
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => { setPlaying(false); }, [animateMascot]);
  return (
    <div className="dashboard">
      <div className="page-heading between">
        <div>
          <h1>Hey {app.name || "there"}, let’s get curious.</h1>
          <p>Big ideas start with little connections.</p>
        </div>
        <span className="badge demo-badge">Your workspace</span>
      </div>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <h2>
            Small steps.
            <br />
            Bright discoveries.
          </h2>
          <p>
            Ask a question, untangle a circuit, or build something new. We’ll
            figure it out together.
          </p>
          <Button asChild>
            <Link href="/ask">
              <MessageCircle size={17} />
              Let’s talk
              <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
        <div className="welcome-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="float-symbol symbol-one">
            <Plus size={21} />
          </span>
          <span className="float-symbol symbol-two">
            <Zap size={23} />
          </span>
          <span className="welcome-mascot dashboard-mascot" data-playing={animateMascot && playing}>
            <Image
              src="/app/mascot.png"
              sizes="(max-width: 767px) 178px, 220px"
              priority
              fetchPriority="high"
              width="240"
              height="275"
              className="mascot"
              alt=""
            />
            {animateMascot && <video
              src="/app/animations/dashboard-ohmi.webm"
              autoPlay loop muted playsInline preload="auto"
              disablePictureInPicture disableRemotePlayback
              tabIndex={-1}
              ref={(video) => { if (video) video.defaultMuted = true; }}
              onPlaying={(event) => {
                try {
                  // Codec support alone cannot prove that a browser preserves WebM alpha.
                  const canvas = document.createElement("canvas");
                  canvas.width = canvas.height = 1;
                  const context = canvas.getContext("2d");
                  if (!context) { setFailed(true); return; }
                  context.drawImage(event.currentTarget, 0, 0);
                  if (context.getImageData(0, 0, 1, 1).data[3] !== 0) setFailed(true);
                  else setPlaying(true);
                } catch { setFailed(true); }
              }}
              onError={() => setFailed(true)}
            />}
          </span>
          <span className="hello-note">
            <span>Hey, builder!</span>
          </span>
        </div>
      </section>
      <section className="quick-section">
        <div className="section-title between">
          <h2>What’s on your mind?</h2>
          <span className="small muted">A little help to get you going</span>
        </div>
        <div className="quick-grid">
          {[
            {
              href: "/assignments",
              icon: FolderOpen,
              title: "Bring an assignment",
              detail: "Your next build starts here.",
              className: "mint",
            },
            {
              href: "/checker",
              icon: ScanLine,
              title: "Check a circuit",
              detail: "Take a closer look together.",
              className: "blue",
            },
            {
              href: "/guide",
              icon: BookOpen,
              title: "Build step by step",
              detail: "Small steps. Real understanding.",
              className: "sand",
            },
          ].map((item) => (
            <Link href={item.href} className="quick-card" key={item.href}>
              <span className={`quick-icon ${item.className}`}>
                <item.icon size={22} strokeWidth={1.6} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
              <ArrowUpRight size={17} className="muted" />
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="panel continue-panel">
          <div className="section-title between">
            <h2>Pick up where you left off</h2>
            <BookOpen size={18} className="muted" />
          </div>
          <div className="lesson-row">
            <div className="circuit-thumbnail">
              <CircuitBoard size={44} strokeWidth={1.2} />
            </div>
            <div>
              <span className="badge">Beginner guide</span>
              <h3>Your first LED circuit</h3>
              <p className="muted">A tiny light. A big first step.</p>
            </div>
          </div>
          <div className="lesson-progress">
            <div className="between small">
              <span>
                {count ? `${count} of 5 steps complete` : "Ready when you are"}
              </span>
              <strong>{progress}%</strong>
            </div>
            <progress
              max="100"
              value={progress}
              aria-label="LED lesson progress"
            />
          </div>
          <Button asChild variant="secondary" className="full-width">
            <Link href="/guide">
              {count ? "Continue learning" : "Start learning"}
              <ArrowRight size={16} />
            </Link>
          </Button>
          <div className="lesson-footnote">
            <Lightbulb size={14} />
            <span>About 10 minutes. Go at your own pace.</span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="section-title between">
            <h2>Your learning trail</h2>
            <Link href="/progress" className="text-link small">
              View all
              <ChevronRight size={15} />
            </Link>
          </div>
          <div className="activity-list">
            {count > 0 ? (
              <div className="activity-row">
                <span className="activity-icon">
                  <Check size={17} />
                </span>
                <div>
                  <strong>Making little connections</strong>
                  <p>{count} guide steps saved</p>
                </div>
              </div>
            ) : (
              <div className="activity-row">
                <span className="activity-icon">
                  <BookOpen size={17} />
                </span>
                <div>
                  <strong>Your first chapter is waiting</strong>
                  <p>Start the LED guide to track progress.</p>
                </div>
              </div>
            )}
            <div className="activity-row">
              <span className="activity-icon">
                <FolderOpen size={17} />
              </span>
              <div>
                <strong>
                  {app.files.length
                    ? `${app.files.length} private learning material${app.files.length > 1 ? "s" : ""}`
                    : "Room for your next idea"}
                </strong>
                <p>
                  {app.files.length
                    ? "Ready to preview in Assignments."
                    : "Add a PDF or screenshot to your library."}
                </p>
              </div>
            </div>
            <div className="activity-row">
              <span className="activity-icon">
                <MessageCircle size={17} />
              </span>
              <div>
                <strong>
                  {app.conversations.some((c) => c.messages.length > 1)
                    ? "You asked. That’s how it starts."
                    : "A good question goes a long way"}
                </strong>
                <p>
                  {
                    app.conversations.filter((c) => c.messages.length > 1)
                      .length
                  }{" "}
                  saved conversations
                </p>
              </div>
            </div>
          </div>
          <div className="trail-note">
            <p>
              Every question is a step forward.
              <br />
              <strong>Keep that curiosity going.</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
