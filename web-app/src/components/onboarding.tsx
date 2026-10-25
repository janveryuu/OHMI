"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as Primitive } from "radix-ui";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { useApp } from "./app-provider";
import { tourSteps } from "@/lib/tour";
import "./onboarding.css";

type Placement = { x: number; y: number; width: number; height: number; left: number; top: number };

export function Onboarding() {
  const app = useApp();
  // Remount account-owned state immediately on an account switch.
  return app.user ? <AccountTour key={app.user.id} /> : null;
}

function AccountTour() {
  const app = useApp(), router = useRouter(), pathname = usePathname().replace(/\/$/, "") || "/";
  const [mode, setMode] = useState<"idle" | "invite" | "tour">("idle");
  const [step, setStep] = useState(0), [placement, setPlacement] = useState<Placement | null>(null);
  const [systemReduced, setSystemReduced] = useState(true);
  const pending = useRef<Promise<boolean> | null>(null), offered = useRef(false), alive = useRef(true);
  const card = useRef<HTMLDivElement>(null), focusBefore = useRef<HTMLElement | null>(null);
  const mask = useId(), current = tourSteps[step];
  const previousPath = useRef(pathname);
  const reduced = app.reduceMotion || systemReduced;
  useEffect(() => {
    const changed = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (mode === "tour" && changed && pathname !== current.route) {
      setMode("idle"); setPlacement(null);
    }
  }, [pathname, mode, current.route]);

  function claim() {
    if (!pending.current) pending.current = fetch("/app/api/onboarding/", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000) })
      .then(async response => {
        if (!response.ok) throw new Error("Tour status could not be saved.");
        return (await response.json()).invite === true;
      }).catch(error => { pending.current = null; throw error; });
    return pending.current;
  }

  useEffect(() => {
    alive.current = true;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => { alive.current = false; media.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (pathname === "/" && !app.loading && !app.error && !offered.current) {
      void claim().then(invite => {
        if (!cancelled && !offered.current && invite) {
          offered.current = true;
          focusBefore.current = document.activeElement as HTMLElement;
          setMode("invite");
        }
      }).catch(() => {}); // Status unavailable means no automatic interruption.
    }
    return () => { cancelled = true; };
  }, [pathname, app.loading, app.error]);

  useEffect(() => {
    const replay = async () => {
      if (app.loading || mode !== "idle") return;
      focusBefore.current = document.activeElement as HTMLElement;
      try {
        await claim();
        if (!alive.current) return;
        offered.current = true;
        setStep(0); setPlacement(null); setMode("tour"); router.push("/");
      } catch { if (alive.current) app.toast("The tour could not be prepared. Please try again."); }
    };
    window.addEventListener("ohmi-start-tour", replay);
    return () => window.removeEventListener("ohmi-start-tour", replay);
  }, [app.loading, mode, router, app.toast]);

  useEffect(() => {
    if (mode !== "tour" || pathname !== current.route) return;
    let timer: ReturnType<typeof setTimeout>, frame = 0, target: HTMLElement | null = null;
    const locate = () => {
      const main = document.querySelector<HTMLElement>("#main");
      return [main?.querySelector<HTMLElement>(current.target), main?.querySelector<HTMLElement>(".page-heading, h1")]
        .find(element => element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden") || null;
    };
    const measure = () => {
      target = locate();
      if (!target || !target.getClientRects().length || !card.current) return;
      const rect = target.getBoundingClientRect(), height = window.visualViewport?.height || innerHeight;
      const width = Math.min(470, innerWidth - 32), cardHeight = card.current.offsetHeight;
      const x = Math.max(8, rect.left - 6), y = Math.max(8, rect.top - 6);
      const bottom = Math.min(height - 8, rect.bottom + 6);
      const top = bottom + 16 + cardHeight < height - 16 ? bottom + 16
        : y - cardHeight - 16 >= 16 ? y - cardHeight - 16 : Math.max(16, height - cardHeight - 16);
      setPlacement({ x, y, width: Math.max(0, Math.min(innerWidth - 8, rect.right + 6) - x), height: Math.max(0, bottom - y),
        left: Math.max(16, Math.min(innerWidth - width - 16, rect.left + rect.width / 2 - width / 2)), top });
    };
    const find = () => {
      const element = locate();
      if (element && element !== target) {
        target = element;
        target.scrollIntoView({ block: "center", behavior: reduced ? "instant" : "smooth" });
        observer.observe(target);
      }
      cancelAnimationFrame(frame); frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(measure);
    const mutations = new MutationObserver(find);
    const main = document.querySelector("#main");
    if (main) mutations.observe(main, { childList: true, subtree: true });
    if (card.current) observer.observe(card.current);
    find(); timer = setTimeout(measure, 450);
    window.addEventListener("resize", measure); window.addEventListener("scrollend", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect();
      window.removeEventListener("resize", measure); window.removeEventListener("scrollend", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [mode, step, pathname, current, reduced]);

  function close() { setMode("idle"); setPlacement(null); }
  function move(next: number) {
    setPlacement(null); setStep(next);
    if (tourSteps[next].route !== pathname) router.push(tourSteps[next].route);
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const previous = focusBefore.current;
    if (previous?.isConnected) previous.focus();
    else document.querySelector<HTMLElement>("#main")?.focus();
  };
  if (app.loading) return null;
  return <>
    <Dialog open={mode === "invite"} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="tour-invitation" onCloseAutoFocus={restoreFocus}>
        <Image src="/app/mascot.png" width={88} height={88} alt="" className="mascot" loading="eager" />
        <DialogTitle>A little help finding your way?</DialogTitle>
        <DialogDescription>Meet OHMI and explore your workspace in a short, optional tour. You can replay it anytime in Settings.</DialogDescription>
        <div className="tour-invite-actions">
          <Button variant="secondary" onClick={close}>Maybe Later</Button>
          <Button onClick={() => { setStep(0); setMode("tour"); }}>Start Tour<ArrowRight size={16} /></Button>
        </div>
      </DialogContent>
    </Dialog>
    <Primitive.Root open={mode === "tour"} onOpenChange={open => { if (!open) close(); }}>
      <Primitive.Portal>
        <Primitive.Overlay className="tour-backdrop">
          <svg width="100%" height="100%" aria-hidden="true">
            <defs><mask id={mask}><rect width="100%" height="100%" fill="white" />
              {placement && <rect x={placement.x} y={placement.y} width={placement.width} height={placement.height} rx={20} fill="black" />}
            </mask></defs>
            <rect width="100%" height="100%" fill="black" opacity=".62" mask={`url(#${mask})`} />
            {placement && <rect x={placement.x} y={placement.y} width={placement.width} height={placement.height} rx={20} fill="none" className="tour-outline" strokeWidth={2} />}
          </svg>
        </Primitive.Overlay>
        <Primitive.Content ref={card} className="tour-card" data-reduced={reduced} style={placement ? { left: placement.left, top: placement.top } : undefined}
          onCloseAutoFocus={restoreFocus} onPointerDownOutside={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()}>
          <div className="tour-card-top">
            <Image src="/app/mascot.png" width={52} height={52} alt="" className="mascot tour-avatar" loading="eager" />
            <div className="tour-count"><span>{step + 1} of {tourSteps.length}</span><progress value={step + 1} max={tourSteps.length} aria-label="Tour progress" /></div>
            <Button variant="ghost" size="icon" aria-label="Close tour" onClick={close}><X size={18} /></Button>
          </div>
          <div className="tour-copy" aria-live="polite" aria-atomic="true" key={step}>
            <Primitive.Title>{current.title}</Primitive.Title>
            <Primitive.Description>{current.text}</Primitive.Description>
          </div>
          {!placement && <p className="tour-loading" role="status">Finding your next stop…</p>}
          <div className="tour-controls">
            <Button variant="ghost" onClick={close}>Skip tour</Button>
            <div><Button variant="secondary" disabled={step === 0} onClick={() => move(step - 1)}><ArrowLeft size={15} />Back</Button>
              <Button disabled={!placement} onClick={() => step === tourSteps.length - 1 ? close() : move(step + 1)}>
                {step === tourSteps.length - 1 ? "Finish" : "Next"}<ArrowRight size={15} />
              </Button></div>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  </>;
}
