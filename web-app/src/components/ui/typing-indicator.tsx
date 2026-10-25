"use client";

import Image from "next/image";
import { useReducedMotion } from "motion/react";

export interface OhmiTypingIndicatorProps {
  message?: string;
  showMascot?: boolean;
  className?: string;
}

export function OhmiTypingIndicator({
  message = "OHMI is preparing your answer…",
  showMascot = true,
  className = "",
}: OhmiTypingIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`ohmi-typing-wrap flex items-center gap-3 py-1.5 ${className}`}
    >
      {showMascot && (
        <div className="ohmi-typing-mascot-box shrink-0 w-8 h-8 rounded-xl bg-accent flex items-center justify-center border border-border/40 shadow-xs">
          <Image
            src="/app/mascot.png"
            alt="OHMI"
            width={22}
            height={26}
            className="mascot object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      )}

      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="ohmi-typing-dots flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-secondary/80 border border-border/50">
            <span
              className={`typing-dot w-1.5 h-1.5 rounded-full bg-primary ${
                reduceMotion ? "opacity-75" : ""
              }`}
              style={{ animationDelay: "0ms" }}
            />
            <span
              className={`typing-dot w-1.5 h-1.5 rounded-full bg-primary ${
                reduceMotion ? "opacity-75" : ""
              }`}
              style={{ animationDelay: "180ms" }}
            />
            <span
              className={`typing-dot w-1.5 h-1.5 rounded-full bg-primary ${
                reduceMotion ? "opacity-75" : ""
              }`}
              style={{ animationDelay: "360ms" }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium select-none truncate">
            {message}
          </span>
        </div>
      </div>
      <span className="sr-only">OHMI is typing an answer</span>
    </div>
  );
}
