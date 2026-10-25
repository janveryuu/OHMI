"use client";

import Image from "next/image";
import { Check, AlertCircle, RotateCcw, X, ScanLine } from "lucide-react";
import { LoadingSpinner } from "./loading-spinner";
import { Button } from "./button";

export interface StageItem {
  id: string;
  label: string;
  detail?: string;
}

export interface AsyncStatusCardProps {
  title: string;
  subtitle?: string;
  stages: StageItem[];
  currentStageId: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  status: "idle" | "loading" | "complete" | "error";
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function AsyncStatusCard({
  title,
  subtitle,
  stages,
  currentStageId,
  thumbnailUrl,
  thumbnailAlt = "Analysis thumbnail",
  status,
  error,
  onRetry,
  onCancel,
  className = "",
}: AsyncStatusCardProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const isLoading = status === "loading";
  const isError = status === "error";
  const isComplete = status === "complete";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`async-status-card panel flex flex-col gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {thumbnailUrl ? (
            <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border/80 bg-secondary shrink-0">
              <img
                src={thumbnailUrl}
                alt={thumbnailAlt}
                className="w-full h-full object-cover"
              />
              {isLoading && (
                <div
                  className="scan-beam absolute inset-x-0 h-1 bg-primary shadow-[0_0_8px_var(--primary)]"
                  aria-hidden="true"
                />
              )}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0 border border-border/40">
              <Image
                src="/app/mascot.png"
                alt="OHMI"
                width={30}
                height={34}
                className="mascot object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>{title}</span>
              {isLoading && <LoadingSpinner size="xs" variant="primary" />}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {isLoading && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            aria-label="Cancel operation"
          >
            <X size={16} />
          </Button>
        )}
      </div>

      {/* Indeterminate glowing track during loading */}
      {isLoading && (
        <div className="relative w-full h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="indeterminate-progress-bar h-full bg-primary rounded-full" />
        </div>
      )}

      {/* Stages list */}
      <div className="flex flex-col gap-2.5 pt-1">
        {stages.map((stage, idx) => {
          const isDone = isComplete || (currentIndex > -1 && idx < currentIndex);
          const isActive = isLoading && idx === currentIndex;
          const isPending = !isDone && !isActive && !isError;
          const isFailedStep = isError && idx === currentIndex;

          return (
            <div
              key={stage.id}
              className={`flex items-start gap-3 text-xs transition-opacity ${
                isPending ? "opacity-50" : "opacity-100"
              }`}
            >
              {/* Step Icon / Circle */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-accent text-accent-foreground border border-primary/50"
                      : isFailedStep
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-secondary text-muted-foreground border border-border"
                }`}
              >
                {isDone ? (
                  <Check size={12} strokeWidth={2.5} />
                ) : isActive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                ) : isFailedStep ? (
                  <AlertCircle size={12} />
                ) : (
                  idx + 1
                )}
              </div>

              {/* Stage labels */}
              <div className="flex-1 min-w-0">
                <span
                  className={`font-medium ${
                    isActive
                      ? "text-primary dark:text-primary-foreground font-semibold"
                      : isDone
                        ? "text-foreground"
                        : isFailedStep
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
                {stage.detail && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {stage.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error state with retry */}
      {isError && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={16} className="shrink-0" />
            <span className="truncate">{error || "Review did not complete."}</span>
          </div>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs shrink-0 flex items-center gap-1.5"
              onClick={onRetry}
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
