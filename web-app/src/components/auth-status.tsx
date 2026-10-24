"use client";
import { useState } from "react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
export function AuthStatus() {
  const app = useApp(),
    [busy, setBusy] = useState(false);
  if (app.loading)
    return (
      <span className="small muted" role="status">
        Loading account…
      </span>
    );
  if (app.user) return <span className="badge">Private workspace</span>;
  return (
    <Button
      variant="outline"
      disabled={busy || !app.configured}
      aria-label="Sign in with Google"
      onClick={async () => {
        setBusy(true);
        try {
          await app.signIn();
        } catch (error) {
          app.toast(
            error instanceof Error ? error.message : "Sign-in unavailable.",
          );
          setBusy(false);
        }
      }}
    >
      Sign in
    </Button>
  );
}
export function AccountNotice() {
  const app = useApp();
  if (!app.configured)
    return (
      <p className="notice" role="status">
        Account services are not configured. Private actions are unavailable.
      </p>
    );
  if (app.error)
    return (
      <div className="notice" role="alert">
        {app.error}{" "}
        <Button variant="ghost" onClick={() => void app.refresh()}>
          Retry
        </Button>
      </div>
    );
  if (!app.user && !app.loading)
    return (
      <p className="notice">
        Sign in with Google to save conversations, materials and learning
        progress.
      </p>
    );
  return null;
}
