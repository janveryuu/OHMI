"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, MessageCircle, Minus, X } from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "./app-provider";
import { FloatingOhmi } from "./floating-ohmi";

type PipApi = {
  requestWindow: (options: {
    width: number;
    height: number;
  }) => Promise<Window>;
};

export function Companion({
  trigger,
  globalLauncher = false,
  className = "",
}: {
  trigger: string;
  globalLauncher?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [small, setSmall] = useState(false);
  const [pip, setPip] = useState<Window | null>(null);
  const [status, setStatus] = useState("");
  const [mounted, setMounted] = useState(false);

  const app = useApp();
  const pipRef = useRef<Window | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      observerRef.current?.disconnect();
      pipRef.current?.close();
    };
  }, []);

  // Global event listener for launch requests
  useEffect(() => {
    if (!globalLauncher) return;
    const handle = () => {
      void launch();
    };
    window.addEventListener("ohmi-launch-companion", handle);
    return () => window.removeEventListener("ohmi-launch-companion", handle);
  }, [globalLauncher, open, pip]);

  // Keep theme & styles in sync if PiP window is open
  useEffect(() => {
    if (!pip) return;
    try {
      const isDark = document.documentElement.dataset.theme === "dark";
      pip.document.documentElement.dataset.theme = isDark ? "dark" : "light";
      pip.document.documentElement.dataset.reduceMotion =
        document.documentElement.dataset.reduceMotion || "false";
      pip.document.documentElement.dataset.largeText =
        document.documentElement.dataset.largeText || "false";
      pip.document.body.style.backgroundColor = isDark ? "#0d1117" : "#ffffff";
    } catch {}
  }, [pip, app.theme, app.reduceMotion, app.largeText]);

  const close = () => {
    observerRef.current?.disconnect();
    pip?.close();
    pipRef.current = null;
    setPip(null);
    setOpen(false);
    setSmall(false);
  };

  async function launch() {
    if (open) {
      if (pip) {
        pip.focus();
      } else {
        setSmall(false);
      }
      return;
    }

    const api = (window as Window & { documentPictureInPicture?: PipApi })
      .documentPictureInPicture;

    if (api) {
      try {
        const win = await api.requestWindow({ width: 420, height: 640 });

        // Copy all existing stylesheets and style tags
        for (const sheet of Array.from(
          document.querySelectorAll('link[rel="stylesheet"],style'),
        )) {
          win.document.head.append(sheet.cloneNode(true));
        }

        // Observe future style changes in main document and mirror to PiP
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
              if (
                node instanceof HTMLLinkElement &&
                node.rel === "stylesheet"
              ) {
                win.document.head.append(node.cloneNode(true));
              } else if (node instanceof HTMLStyleElement) {
                win.document.head.append(node.cloneNode(true));
              }
            }
          }
        });
        observer.observe(document.head, { childList: true });
        observerRef.current = observer;

        // Clone root attributes and fonts
        win.document.documentElement.className = document.documentElement.className;
        win.document.documentElement.dataset.theme =
          document.documentElement.dataset.theme || "light";
        win.document.documentElement.dataset.reduceMotion =
          document.documentElement.dataset.reduceMotion || "false";
        win.document.documentElement.dataset.largeText =
          document.documentElement.dataset.largeText || "false";

        win.document.title = "OHMI — Your Circuit Buddy";
        win.document.body.className = document.body.className;
        win.document.body.style.margin = "0";
        win.document.body.style.padding = "0";
        win.document.body.style.overflow = "hidden";
        win.document.body.style.backgroundColor =
          document.documentElement.dataset.theme === "dark" ? "#0d1117" : "#ffffff";

        win.addEventListener(
          "pagehide",
          () => {
            observer.disconnect();
            pipRef.current = null;
            setPip(null);
            setOpen(false);
            setSmall(false);
          },
          { once: true },
        );

        pipRef.current = win;
        setPip(win);
        setStatus("Floating companion window opened.");
      } catch {
        setStatus("Picture-in-Picture unavailable. Opened in-app companion instead.");
        setPip(null);
      }
    } else {
      setStatus("Document Picture-in-Picture not supported in this browser. Opened in-app companion.");
      setPip(null);
    }

    setOpen(true);
    setSmall(false);
  }

  // Minimized pill in in-app mode
  const minimizedPill = (
    <div
      className="floating-ohmi-minimized-pill"
      onClick={() => setSmall(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSmall(false);
        }
      }}
      aria-label="Expand OHMI circuit companion"
    >
      <div className="mascot-squircle" aria-hidden="true">
        <Image
          src="/app/mascot.png"
          width={20}
          height={24}
          alt=""
          className="mascot"
          unoptimized
        />
      </div>
      <strong>OHMI</strong>
      <span className="text-xs text-neutral-400">Ask question</span>
      <button
        type="button"
        className="floating-ohmi-icon-btn p-1 ml-1 text-neutral-400 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        aria-label="Close OHMI companion"
      >
        <X size={14} />
      </button>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        className={`launch-button ${className}`}
        onClick={launch}
        aria-label="Launch Floating OHMI companion window"
      >
        <span>{trigger}</span>
        <ArrowUpRight size={15} aria-hidden="true" />
      </Button>

      <span className="sr-only" role="status">
        {status}
      </span>

      {open &&
        mounted &&
        createPortal(
          pip ? (
            <FloatingOhmi
              isPip={true}
              pipWindow={pip}
              onClose={close}
            />
          ) : small ? (
            minimizedPill
          ) : (
            <FloatingOhmi
              isPip={false}
              onClose={close}
              onMinimize={() => setSmall(true)}
              isMinimized={false}
            />
          ),
          pip ? pip.document.body : document.body,
        )}
    </>
  );
}
export { FloatingOhmi };
