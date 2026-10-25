"use client";

import { useReducedMotion } from "motion/react";

export interface LoadingSkeletonProps {
  variant?: "text" | "circular" | "rectangular" | "card" | "text-block";
  width?: string | number;
  height?: string | number;
  className?: string;
  lines?: number;
  ariaLabel?: string;
}

export function LoadingSkeleton({
  variant = "text",
  width,
  height,
  className = "",
  lines = 3,
  ariaLabel = "Loading content…",
}: LoadingSkeletonProps) {
  const reduceMotion = useReducedMotion();

  const shimmerClass = reduceMotion ? "" : "skeleton-shimmer";

  if (variant === "text-block") {
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        className={`flex flex-col gap-2.5 w-full ${className}`}
      >
        {Array.from({ length: lines }).map((_, i) => {
          const lineWidth =
            i === lines - 1 && lines > 1
              ? "55%"
              : i === lines - 2 && lines > 2
                ? "80%"
                : "100%";
          return (
            <div
              key={i}
              className={`h-3 rounded-md bg-secondary/80 ${shimmerClass}`}
              style={{ width: lineWidth }}
            />
          );
        })}
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }

  if (variant === "circular") {
    const dim = width || height || 40;
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        className={`rounded-full bg-secondary/80 shrink-0 ${shimmerClass} ${className}`}
        style={{ width: dim, height: dim }}
      >
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        className={`p-4 rounded-2xl border border-border bg-card/60 flex flex-col gap-3 ${className}`}
        style={{ width, height }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl bg-secondary/80 shrink-0 ${shimmerClass}`}
          />
          <div className="flex flex-col gap-1.5 flex-1">
            <div
              className={`h-3.5 w-1/3 rounded-md bg-secondary/80 ${shimmerClass}`}
            />
            <div
              className={`h-2.5 w-1/2 rounded-md bg-secondary/60 ${shimmerClass}`}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <div
            className={`h-3 w-full rounded-md bg-secondary/80 ${shimmerClass}`}
          />
          <div
            className={`h-3 w-4/5 rounded-md bg-secondary/80 ${shimmerClass}`}
          />
          <div
            className={`h-3 w-2/3 rounded-md bg-secondary/70 ${shimmerClass}`}
          />
        </div>
        <span className="sr-only">{ariaLabel}</span>
      </div>
    );
  }

  const defaultHeight = variant === "rectangular" ? (height || 120) : (height || 14);

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`rounded-md bg-secondary/80 ${shimmerClass} ${className}`}
      style={{
        width: width || (variant === "text" ? "100%" : "100%"),
        height: defaultHeight,
      }}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
