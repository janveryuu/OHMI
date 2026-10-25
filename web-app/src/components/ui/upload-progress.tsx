"use client";

import { useState } from "react";
import {
  FileText,
  ImageIcon,
  Check,
  AlertCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "./button";
import { LoadingSpinner } from "./loading-spinner";

export type UploadStage =
  | "preparing"
  | "uploading"
  | "processing"
  | "saving"
  | "complete"
  | "error";

export interface UploadProgressProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  stage: UploadStage;
  percent?: number;
  error?: string;
  previewUrl?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const stageLabels: Record<UploadStage, string> = {
  preparing: "Preparing file…",
  uploading: "Uploading to private storage…",
  processing: "Processing preview…",
  saving: "Saving record…",
  complete: "Saved privately to your library",
  error: "Upload failed",
};

export function UploadProgress({
  fileName,
  fileSize,
  fileType,
  stage,
  percent,
  error,
  previewUrl,
  onCancel,
  onRetry,
  onDismiss,
  className = "",
}: UploadProgressProps) {
  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isComplete = stage === "complete";
  const isError = stage === "error";
  const isProcessing = !isComplete && !isError;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`upload-progress-card panel flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card shadow-xs transition-all ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail or File Icon */}
        <div className="shrink-0 w-11 h-11 rounded-xl bg-secondary flex items-center justify-center overflow-hidden border border-border/60">
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : isPdf ? (
            <span className="flex flex-col items-center justify-center text-primary">
              <FileText size={20} />
              <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
                PDF
              </span>
            </span>
          ) : (
            <ImageIcon size={20} className="text-muted-foreground" />
          )}
        </div>

        {/* File details & stage text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground truncate" title={fileName}>
              {fileName}
            </h4>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatBytes(fileSize)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-xs">
            {isProcessing && (
              <LoadingSpinner size="xs" variant="primary" label="" />
            )}
            {isComplete && (
              <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
            {isError && (
              <AlertCircle size={14} className="text-destructive" />
            )}
            <span
              className={`truncate ${
                isError
                  ? "text-destructive font-medium"
                  : isComplete
                    ? "text-emerald-700 dark:text-emerald-300 font-medium"
                    : "text-muted-foreground"
              }`}
            >
              {isError ? error || stageLabels.error : stageLabels[stage]}
            </span>
          </div>
        </div>

        {/* Action button: Cancel, Retry, or Dismiss */}
        <div className="shrink-0 flex items-center">
          {isProcessing && onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onCancel}
              aria-label={`Cancel upload of ${fileName}`}
            >
              <X size={16} />
            </Button>
          )}
          {isError && onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
              onClick={onRetry}
            >
              <RotateCcw size={13} />
              <span>Retry</span>
            </Button>
          )}
          {isComplete && onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onDismiss}
              aria-label="Dismiss completion notice"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative w-full h-1.5 rounded-full bg-secondary overflow-hidden">
        {isComplete ? (
          <div className="h-full w-full bg-emerald-500 rounded-full transition-all duration-300" />
        ) : isError ? (
          <div className="h-full w-full bg-destructive/60 rounded-full" />
        ) : typeof percent === "number" && percent >= 0 && percent <= 100 ? (
          <div
            className="h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="indeterminate-progress-bar h-full bg-primary rounded-full" />
        )}
      </div>
    </div>
  );
}
