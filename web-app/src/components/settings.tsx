"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Accessibility,
  Check,
  ChevronRight,
  Globe2,
  Laptop,
  Moon,
  ShieldCheck,
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
import { UserAvatar } from "./ui/user-avatar";
import { AvatarModal } from "./avatar-modal";
import { Sparkles } from "lucide-react";

export function Settings() {
  const app = useApp(),
    [edit, setEdit] = useState(false),
    [name, setName] = useState(app.name),
    [reset, setReset] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [aiEnabled, setAiEnabled] = useState(false),
    [avatarModalOpen, setAvatarModalOpen] = useState(false);
  useEffect(() => {
    void fetch("/app/api/ai/", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAiEnabled(data.enabled === true))
      .catch(() => setAiEnabled(false));
    if (new URLSearchParams(location.search).get("auth") === "failed")
      setError("Google sign-in did not finish. Try again in the same browser.");
  }, []);
  useEffect(() => {
    setEdit(false);
    setName("");
    setError("");
  }, [app.user?.id]);
  return (
    <div className="settings-page stack">
      <div className="page-heading">
        <h1>Make yourself at home.</h1>
        <p>Your workspace, a little more you.</p>
      </div>
      <section className="panel profile-panel">
        <div className="profile-avatar-container">
          <button
            type="button"
            className="profile-avatar-btn"
            onClick={() => setAvatarModalOpen(true)}
            aria-label="Change OHMI avatar"
            title="Change your OHMI avatar"
          >
            <UserAvatar
              avatarId={app.avatar}
              name={app.name}
              size={72}
              className="profile-avatar"
              priority
            />
            <span className="profile-avatar-badge" aria-hidden="true">
              <Sparkles size={13} />
            </span>
          </button>
        </div>
        <div className="profile-details">
          <h2>{app.name || "Your account"}</h2>
          <p className="muted">Curious mind. Circuit builder.</p>
          <span className="badge">
            {app.user ? "Private account" : "Not signed in"}
          </span>
          {app.user && <p className="small muted">{app.user.email}</p>}
        </div>
        <div className="profile-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAvatarModalOpen(true)}
            aria-label="Change avatar"
            className="avatar-change-btn"
          >
            <Sparkles size={14} className="mr-1.5" aria-hidden="true" />
            Change avatar
          </Button>
          <Button
            disabled={!app.user || busy}
            variant="outline"
            onClick={() => {
              setName(app.name);
              setEdit(true);
            }}
          >
            Edit profile
          </Button>
        </div>
      </section>
      <section className="panel tour-help" aria-label="Workspace help">
        <div><h2>Find your way around</h2><p className="muted">A short introduction to OHMI's learning tools.</p></div>
        <Button variant="outline" disabled={!app.user || app.loading} onClick={() => window.dispatchEvent(new Event("ohmi-start-tour"))}>Take a Tour</Button>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <Button
          disabled={busy || !app.configured}
          variant={app.user ? "outline" : "default"}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              if (app.user) await app.signOut();
              else await app.signIn();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Account action failed.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {app.user ? "Sign out" : "Sign in with Google"}
        </Button>
      </div>
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
              Saved to your profile when signed in. OHMI uses this language for
              answers; interface labels remain in English.
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
              <span className="badge neutral-badge">
                {app.user ? "Connected" : "Sign in required"}
              </span>
            </div>
            <div className="integration-row">
              <span>AI tutoring</span>
              <span className="badge neutral-badge">
                {aiEnabled ? "Available" : "Paused"}
              </span>
            </div>
            <div className="integration-row">
              <span>Cloud storage</span>
              <span className="badge neutral-badge">
                {app.user ? "Connected" : "Sign in required"}
              </span>
            </div>
            <p className="small muted">
              Signed-in materials, conversations and tutorial progress are
              private to your account. Only public fallback assets are stored
              for offline use.
            </p>
            <Button variant="outline" onClick={() => setReset(true)}>
              Reload workspace
            </Button>
          </section>
        </div>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogTitle>A name for your workspace.</DialogTitle>
          <DialogDescription>
            This updates the display name on your private account.
          </DialogDescription>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await app.saveProfile({ name });
                setEdit(false);
                app.toast("Profile saved.");
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Profile could not be saved.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Display name
              <input
                className="input"
                name="given-name"
                autoComplete="given-name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <AvatarModal open={avatarModalOpen} onOpenChange={setAvatarModalOpen} />
      <Dialog open={reset} onOpenChange={setReset}>
        <DialogContent>
          <DialogTitle>Start fresh?</DialogTitle>
          <DialogDescription>
            Reload the latest saved data. Your private records and device
            preferences are preserved.
          </DialogDescription>
          <div className="row">
            <Button variant="outline" onClick={() => setReset(false)}>
              Keep workspace
            </Button>
            <Button variant="destructive" onClick={() => location.reload()}>
              Reload workspace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
