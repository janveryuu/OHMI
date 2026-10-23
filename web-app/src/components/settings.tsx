"use client";
import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";
import {
  Accessibility,
  Check,
  ChevronRight,
  Globe2,
  Laptop,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { PwaControls } from "./pwa-controls";
import { Companion } from "./companion";

export function Settings() {
  const app = useApp(),
    [edit, setEdit] = useState(false),
    [name, setName] = useState(app.name),
    [reset, setReset] = useState(false);
  return (
    <div className="settings-page stack">
      <div className="page-heading">
        <h1>Make yourself at home.</h1>
        <p>Your workspace, a little more you.</p>
      </div>
      <section className="panel profile-panel">
        <span className="avatar profile-avatar">
          {app.name.slice(0, 1) || "A"}
        </span>
        <div>
          <h2>{app.name || "Alex"} Rivera</h2>
          <p className="muted">Curious mind. Circuit builder.</p>
          <span className="badge">Demo profile</span>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setName(app.name);
            setEdit(true);
          }}
        >
          Edit profile
        </Button>
      </section>
      <div className="settings-columns">
        <div className="stack">
          <section className="panel stack">
            <div className="row">
              <Sun size={20} />
              <h2>A space that feels right.</h2>
            </div>
            <div>
              <h3>Appearance</h3>
              <p className="muted small">
                Choose your light. System follows your device.
              </p>
            </div>
            <div className="theme-options">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Laptop },
              ].map((item) => (
                <button
                  key={item.value}
                  className={`theme-choice ${app.theme === item.value ? "selected" : ""}`}
                  aria-pressed={app.theme === item.value}
                  onClick={() => app.setTheme(item.value)}
                >
                  <span className={`theme-sample sample-${item.value}`}>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="row">
                    <item.icon size={15} />
                    {item.label}
                    {app.theme === item.value && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
            <div className="separator" />
            <div className="row">
              <Accessibility size={20} />
              <h3>Comfort & accessibility</h3>
            </div>
            <label className="setting-row">
              <span>
                <strong>Reduce motion</strong>
                <small>Gentler transitions and a still mascot.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={app.reduceMotion}
                onChange={(e) => app.setReduceMotion(e.target.checked)}
              />
            </label>
            <label className="setting-row">
              <span>
                <strong>Larger text</strong>
                <small>A little extra room for reading.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={app.largeText}
                onChange={(e) => app.setLargeText(e.target.checked)}
              />
            </label>
            <p className="small muted">
              Appearance and accessibility preferences are saved on this device.
            </p>
          </section>
          <section className="panel stack">
            <div className="row">
              <Globe2 size={20} />
              <h2>Speak your language.</h2>
            </div>
            <label className="field">
              Preferred language
              <select
                className="input"
                name="language"
                value={app.language}
                onChange={(e) => app.setLanguage(e.target.value)}
              >
                {["English", "Filipino", "Taglish"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <p className="small muted">
              Preference preview only. Interface and preset replies remain in
              English until language services are connected.
            </p>
          </section>
        </div>
        <div className="stack settings-right">
          <section className="panel stack">
            <div className="row">
              <Image
                src="/app/mascot.png"
                width="40"
                height="46"
                alt=""
                className="mascot"
              />
              <h2>Your buddy, on hand.</h2>
            </div>
            <p className="muted">
              Install OHMI for a little more app, a little less browser.
            </p>
            <PwaControls />
            <div className="separator" />
            <h3>Keep OHMI close.</h3>
            <p className="muted small">
              A compact companion window when supported, with an in-app
              fallback.
            </p>
            <Companion trigger="Launch Floating OHMI" />
          </section>
          <section className="panel stack">
            <div className="row">
              <ShieldCheck size={22} />
              <h2>A little transparency.</h2>
            </div>
            <div className="integration-row">
              <span>Account & sign-in</span>
              <span className="badge neutral-badge">Not connected</span>
            </div>
            <div className="integration-row">
              <span>AI tutoring</span>
              <span className="badge neutral-badge">Preset demo</span>
            </div>
            <div className="integration-row">
              <span>Cloud storage</span>
              <span className="badge neutral-badge">Not connected</span>
            </div>
            <p className="small muted">
              Your questions, files and progress stay in this session.
              Refreshing clears them. No student data is sent to a server.
            </p>
            <Button variant="outline" onClick={() => setReset(true)}>
              Reset demo workspace
            </Button>
          </section>
        </div>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogTitle>A name for your workspace.</DialogTitle>
          <DialogDescription>
            Demo profile only. No account is created. Your name stays in memory.
          </DialogDescription>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              app.setName(name.trim() || "Alex");
              setEdit(false);
              app.toast("Demo profile updated for this session.");
            }}
          >
            <label className="field">
              First name
              <input
                className="input"
                name="given-name"
                autoComplete="given-name"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button type="submit">Save demo profile</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={reset} onOpenChange={setReset}>
        <DialogContent>
          <DialogTitle>Start fresh?</DialogTitle>
          <DialogDescription>
            This clears local demo conversations, materials and guide progress
            by reloading the app. Original files and appearance preferences stay
            unchanged.
          </DialogDescription>
          <div className="row">
            <Button variant="outline" onClick={() => setReset(false)}>
              Keep workspace
            </Button>
            <Button variant="destructive" onClick={() => location.reload()}>
              Reset workspace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
