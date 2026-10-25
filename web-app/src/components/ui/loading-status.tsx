"use client";

import { Check, AlertCircle, RotateCcw } from "lucide-react";
import { LoadingSpinner } from "./loading-spinner";
import { Button } from "./button";

export interface LoadingStatusProps {
  state: "idle" | "loading" | "success" | "error";
  text: string;
  size?: "sm" | "md";
  className?: string;
  onRetry?: () => void;
}

export function LoadingStatus({
  state,
  text,
  size = "md",
  className = "",
  onRetry,
}: LoadingStatusProps) {
  if (state === "idle" && !text) return null;

  const isSmall = size === "sm";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        state === "loading"
          ? "bg-accent/70 text-accent-foreground border border-border"
          : state === "success"
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            : state === "error"
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-secondary text-secondary-foreground"
      } ${className}`}
    >
      {state === "loading" && (
        <LoadingSpinner
          size={isSmall ? "xs" : "sm"}
          variant="primary"
          label=""
        />
      )}
      {state === "success" && (
        <Check size={isSmall ? 13 : 15} className="text-emerald-600 dark:text-emerald-400" />
      )}
      {state === "error" && (
        <AlertCircle size={isSmall ? 13 : 15} className="text-destructive" />
      )}
      <span className="truncate">{text}</span>
      {state === "error" && onRetry && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-0.5 rounded-full p-0 hover:bg-destructive/15 text-destructive"
          onClick={onRetry}
          aria-label="Retry action"
        >
          <RotateCcw size={12} />
        </Button>
      )}
    </div>
  );
}
