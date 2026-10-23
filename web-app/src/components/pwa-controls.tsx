"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let deferredInstall: InstallEvent | null = null;
export function PwaControls({ statusOnly = false }: { statusOnly?: boolean }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [help, setHelp] = useState(false),
    [installed, setInstalled] = useState(false),
    [offline, setOffline] = useState(false);
  useEffect(() => {
    let disposed = false;
    let releaseUpdate = () => {};
    setInstalled(matchMedia("(display-mode: standalone)").matches);
    setOffline(!navigator.onLine);
    setPrompt(deferredInstall);
    const online = () => setOffline(!navigator.onLine),
      install = (event: Event) => {
        event.preventDefault();
        deferredInstall = event as InstallEvent;
        setPrompt(deferredInstall);
      },
      done = () => {
        deferredInstall = null;
        setPrompt(null);
        setInstalled(true);
      };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (disposed) return;
          if (reg.waiting) setWaiting(reg.waiting);
          const update = () => {
            const worker = reg.installing;
            const changed = () => {
              if (
                worker?.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(worker);
            };
            worker?.addEventListener("statechange", changed);
            releaseUpdate = () => {
              reg.removeEventListener("updatefound", update);
              worker?.removeEventListener("statechange", changed);
            };
          };
          reg.addEventListener("updatefound", update);
          releaseUpdate = () => reg.removeEventListener("updatefound", update);
        })
        .catch(() => setHelp(true));
    return () => {
      disposed = true;
      releaseUpdate();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(!help);
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setHelp(true);
    }
    deferredInstall = null;
    setPrompt(null);
  }
  return (
    <div className={statusOnly ? "pwa-status" : "stack-sm"}>
      {offline && (
        <p className="notice" role="status">
          You’re offline. Public app shell only.
        </p>
      )}
      {!statusOnly && (
        <>
          <Button variant="outline" onClick={install} disabled={installed}>
            <Download size={16} />
            {installed ? "App installed" : "Install OHMI"}
          </Button>
          {help && (
            <p className="small muted">
              On iPhone/iPad, open in Safari, tap Share, then Add to Home
              Screen. On supported desktop/Android browsers, use Install in the
              browser menu. HTTPS or localhost is required.
            </p>
          )}
        </>
      )}
      {waiting && (
        <div className="notice">
          <p>
            An update is ready. Applying it clears this session’s demo content.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: "ACTIVATE_UPDATE" });
            }}
          >
            <RefreshCw size={15} />
            Apply update
          </Button>
        </div>
      )}
    </div>
  );
}
