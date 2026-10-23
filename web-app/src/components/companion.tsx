"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, MessageCircle, Minus, X } from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "./app-provider";
type PipApi = {
  requestWindow: (options: {
    width: number;
    height: number;
  }) => Promise<Window>;
};
export function Companion({
  trigger,
  globalLauncher = false,
}: {
  trigger: string;
  globalLauncher?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [small, setSmall] = useState(false),
    [pip, setPip] = useState<Window | null>(null);
  const [status, setStatus] = useState(""),
    [dragged, setDragged] = useState(false),
    [mounted, setMounted] = useState(false);
  const app = useApp(),
    reduced = useReducedMotion();
  const pipRef = useRef<Window | null>(null);
  useEffect(() => {
    setMounted(true);
    return () => pipRef.current?.close();
  }, []);
  useEffect(() => {
    if (!globalLauncher) return;
    const handle = () => {
      void launch();
    };
    window.addEventListener("ohmi-launch-companion", handle);
    return () => window.removeEventListener("ohmi-launch-companion", handle);
  }, [globalLauncher, open, pip]);
  const close = () => {
    pip?.close();
    pipRef.current = null;
    setPip(null);
    setOpen(false);
  };
  async function launch() {
    if (open) {
      pip?.focus();
      return;
    }
    const api = (window as Window & { documentPictureInPicture?: PipApi })
      .documentPictureInPicture;
    if (api)
      try {
        const win = await api.requestWindow({ width: 360, height: 420 });
        for (const sheet of Array.from(
          document.querySelectorAll('link[rel="stylesheet"],style'),
        ))
          win.document.head.append(sheet.cloneNode(true));
        win.document.documentElement.dataset.theme =
          document.documentElement.dataset.theme;
        win.document.title = "Floating OHMI";
        win.document.body.style.margin = "0";
        win.addEventListener(
          "pagehide",
          () => {
            pipRef.current = null;
            setPip(null);
            setOpen(false);
          },
          { once: true },
        );
        pipRef.current = win;
        setPip(win);
        setStatus("Floating window opened.");
      } catch {
        setStatus("Window unavailable. OHMI opened inside this app.");
      }
    else setStatus("This browser uses the in-app companion.");
    setOpen(true);
  }
  const content = (
    <motion.section
      role="region"
      aria-label="Floating OHMI companion"
      className={`floating-companion ${small ? "minimized" : ""} ${pip ? "pip-companion" : ""}`}
      drag={!pip && !reduced && !app.reduceMotion}
      dragMomentum={false}
      dragConstraints={{ top: -250, bottom: 0, left: -250, right: 0 }}
      onDragStart={() => setDragged(true)}
      initial={reduced ? false : { opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
    >
      <div className="between">
        <span className="row">
          <Image
            src="/app/mascot.png"
            width="28"
            height="32"
            alt=""
            className="mascot"
          />
          <strong>OHMI is here</strong>
        </span>
        <div className="row">
          <Button
            variant="ghost"
            size="icon"
            aria-label={small ? "Expand companion" : "Minimize companion"}
            onClick={() => setSmall(!small)}
          >
            <Minus size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close companion"
            onClick={close}
          >
            <X size={17} />
          </Button>
        </div>
      </div>
      {!small && (
        <>
          <Image
            src="/app/mascot.png"
            width="110"
            height="126"
            alt="OHMI, your mint pixel-art circuit buddy"
            className="mascot companion-art"
          />
          <h3>A little stuck? I’m here.</h3>
          <p className="muted">
            Keep building. Let’s work through the tricky bits together.
          </p>
          <span className="badge">Frontend demo</span>
          <Button
            onClick={() => {
              close();
              router.push("/ask");
            }}
          >
            <MessageCircle size={16} />
            Ask OHMI
            <ArrowUpRight size={15} />
          </Button>
          <p className="small muted">
            {pip
              ? "Companion window. Chat opens in the main app."
              : dragged
                ? "Drag to move. Close and reopen to reset."
                : "Drag to move, or use the controls above."}
          </p>
        </>
      )}
    </motion.section>
  );
  return (
    <>
      <Button variant="outline" className="launch-button" onClick={launch}>
        {trigger}
        <ArrowUpRight size={15} />
      </Button>
      <span className="sr-only" role="status">
        {status}
      </span>
      {open &&
        mounted &&
        createPortal(content, pip ? pip.document.body : document.body)}
    </>
  );
}
