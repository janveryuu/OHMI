"use client";

import { useReducedMotion } from "motion/react";

export interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  variant?: "primary" | "muted" | "current";
}

const sizeMap = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

const strokeMap = {
  xs: 2.5,
  sm: 2.5,
  md: 3,
  lg: 3,
  xl: 3.5,
};

export function LoadingSpinner({
  size = "md",
  className = "",
  label = "Loading…",
  variant = "primary",
}: LoadingSpinnerProps) {
  const reduceMotion = useReducedMotion();
  const dimension = sizeMap[size];
  const strokeWidth = strokeMap[size];
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colorClass =
    variant === "primary"
      ? "text-primary"
      : variant === "muted"
        ? "text-muted-foreground"
        : "currentColor";

  return (
    <span
      role="status"
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={reduceMotion ? "opacity-80" : "animate-spin"}
        style={{
          animationDuration: "0.85s",
          animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        aria-hidden="true"
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="opacity-20"
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.72}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
