"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { safeReturnPath } from "@/lib/backend/guards.mjs";
import { PwaControls } from "./pwa-controls";

const authErrors: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Continue when you’re ready.",
  failed: "Google sign-in did not finish. Try again in this browser.",
  unavailable: "Account services could not be reached. Check your connection and try again.",
};

export function Login() {
  const app = useApp();
  const router = useRouter();
  const systemReduced = useReducedMotion();
  const reduced = app.reduceMotion || systemReduced;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState("/app/");
  const [systemDark, setSystemDark] = useState(false);
  const dark = app.theme === "dark" || (app.theme === "system" && systemDark);
  const message = error || app.error;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNext(safeReturnPath(params.get("next")));
    setError(authErrors[params.get("auth") || ""] || "");
    const restore = () => setBusy(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  useEffect(() => {
    if (app.user) router.replace(next.replace(/^\/app/, "") || "/");
  }, [app.user, next, router]);
  const enter = {
    initial: reduced ? false as const : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, stiffness: 230, damping: 28 },
  };
  return (
    <main className="login-page" id="main">
      <PwaControls statusOnly />
      <a className="skip" href="#welcome">Skip to sign in</a>
      <div className="login-frame">
        <section className="login-scene" aria-label="OHMI countryside illustration">
          <Image src="/app/welcome-countryside.webp" alt="OHMI and a student resting on a grassy hill beneath a bright, open sky." fill sizes="(min-width: 900px) 55vw, 100vw" priority className="login-countryside" />
          <div className="login-scene-brand" aria-hidden="true">OHMI<span>.</span></div>
          <div className="login-scene-caption"><p>A little curiosity.<br />A world of possibility.</p><span>Your circuit buddy, by your side.</span></div>
        </section>
        <section className="login-panel" aria-labelledby="welcome">
          <header className="login-nav">
            <a href="https://meetohmi.vercel.app/" className="login-back"><ArrowLeft size={16} aria-hidden="true" /><span>Back to OHMI</span></a>
            <Button variant="ghost" size="icon" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={() => app.setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </header>
          <div className="login-content">
            <motion.div className="login-mascot" {...enter}>
              <motion.div animate={reduced ? {} : { y: [0, -5, 0] }} transition={{ duration: 3.8, ease: "easeInOut", delay: 0.35 }}>
                <Image src="/app/mascot.png" alt="OHMI, your friendly circuit buddy" width={180} height={180} sizes="(min-width: 900px) 180px, 124px" priority />
              </motion.div>
            </motion.div>
            <motion.div {...enter} transition={{ ...enter.transition, delay: reduced ? 0 : 0.08 }}>
              <h1 id="welcome" tabIndex={-1}>Welcome to OHMI.</h1>
              <p className="login-subtitle">Your circuit buddy is ready when you are.</p>
            </motion.div>
            <motion.div className="login-action" {...enter} transition={{ ...enter.transition, delay: reduced ? 0 : 0.16 }}>
              <motion.div whileTap={reduced ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}>
                <Button className="google-signin" variant="outline" disabled={busy || !app.configured || app.loading || Boolean(app.user)} aria-busy={busy || app.loading || Boolean(app.user)} aria-describedby="login-feedback" onClick={async () => {
                  if (!navigator.onLine) { setError("You’re offline. Reconnect and try again."); return; }
                  setBusy(true);
                  setError("");
                  try { await app.signIn(next); }
                  catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in could not start. Try again."); setBusy(false); }
                }}>
                  <Image src="/app/google-g.svg" alt="" width={20} height={20} />
                  <span>{busy ? "Connecting to Google…" : app.loading || app.user ? "Restoring your session…" : "Continue with Google"}</span>
                </Button>
              </motion.div>
              <div id="login-feedback" className={`login-feedback ${message ? "login-error" : ""}`} aria-live="polite" aria-atomic="true">
                {message || (!app.configured ? "Account services are unavailable. Please try again later." : busy ? "Opening Google’s secure sign-in…" : "Your assignments, chats, and progress. All in one place.")}
              </div>
            </motion.div>
          </div>
          <footer className="login-footer">A little help, wherever curiosity takes you.</footer>
        </section>
      </div>
    </main>
  );
}
