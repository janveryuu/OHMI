"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package,
  Download,
  FileText,
  Code,
  Image as ImageIcon,
  Table,
  CheckCircle2,
  AlertCircle,
  Check,
  Layers,
  ListChecks,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  buildTinkercadLearningKit,
  type TinkercadLearningKitBundle,
  type ExportedFilePreview,
  type TinkercadConnection,
} from "@/lib/playground/tinkercad-export";

interface TinkercadExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Record<string, unknown> | null;
  svgData?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(format: string) {
  switch (format) {
    case "PDF Document":
      return <FileText className="w-5 h-5 text-red-500" />;
    case "Arduino Sketch":
      return <Code className="w-5 h-5 text-teal-600 dark:text-teal-400" />;
    case "PNG Image":
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    case "Spreadsheet / CSV":
      return <Table className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    default:
      return <Layers className="w-5 h-5 text-indigo-500" />;
  }
}

export function TinkercadExportModal({
  isOpen,
  onClose,
  document,
  svgData,
}: TinkercadExportModalProps) {
  const [activeTab, setActiveTab] = useState<"kit" | "guide">("kit");
  const [isGenerating, setIsGenerating] = useState(false);
  const [bundle, setBundle] = useState<TinkercadLearningKitBundle | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Generate kit whenever modal opens or document changes
  useEffect(() => {
    if (!isOpen || !document) return;

    let isMounted = true;
    setIsGenerating(true);
    setDownloadSuccess(false);

    buildTinkercadLearningKit(document, svgData)
      .then((kit) => {
        if (isMounted) {
          setBundle(kit);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error("Failed to build Tinkercad Learning Kit:", err);
        if (isMounted) {
          setIsGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, document, svgData]);

  const handleDownloadZip = () => {
    if (!bundle) return;

    try {
      const blob = new Blob([bundle.zipBytes as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = bundle.filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleDownloadSingleFile = (file: ExportedFilePreview) => {
    if (!bundle) return;

    let blob: Blob;
    let filename: string = file.name;

    if (file.name === "Wiring_Guide.pdf") {
      const pdfBytes = bundle.zipBytes; // We can re-fetch or use individual file
      // Trigger full zip or specific download
      handleDownloadZip();
      return;
    } else if (file.name === "Arduino_Sketch.ino") {
      blob = new Blob([bundle.summary.arduinoSketch], { type: "text/plain;charset=utf-8" });
    } else if (file.name === "Original_Project.dez") {
      blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json;charset=utf-8" });
    } else {
      handleDownloadZip();
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const totalSteps = bundle?.summary.connections.length || 0;
  const completedCount = completedSteps.size;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl w-full p-0 overflow-hidden border border-border/80 shadow-2xl rounded-3xl bg-card/95 backdrop-blur-xl flex flex-col max-h-[90vh]"
        showCloseButton
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-gradient-to-b from-teal-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-sm">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  Export for Tinkercad
                </DialogTitle>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  Learning Kit
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Complete learning kit with step-by-step wiring guide, Arduino sketch, parts list, and reference diagram.
              </DialogDescription>
            </div>
          </div>

          {/* Quick Metrics */}
          {bundle && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 font-medium">
                <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {bundle.summary.parts.length} components
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {bundle.summary.connections.length} wires routed
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 font-medium">
                <Code className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {bundle.summary.hasArduino ? "Arduino C++ Sketch" : "Passive Circuit"}
              </span>
            </div>
          )}

          {/* Warnings notice if any */}
          {bundle && bundle.summary.warnings.length > 0 && (
            <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Routing Notice:</p>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px]">
                  {bundle.summary.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab("kit")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "kit"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Kit Bundle (5 Files)
            </button>
            <button
              onClick={() => setActiveTab("guide")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "guide"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Follow Wiring Guide ({completedCount}/{totalSteps})
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-foreground">
                Analyzing circuit & packaging Tinkercad kit...
              </p>
              <p className="text-xs text-muted-foreground">
                Compiling wiring checklist, pin assignments, and PDF documentation.
              </p>
            </div>
          ) : activeTab === "kit" ? (
            <div className="space-y-4">
              {/* File Previews List */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Package Contents in ZIP
                </p>
                <div className="divide-y divide-border/50 rounded-2xl border border-border/80 bg-background/50 overflow-hidden">
                  {bundle?.files.map((file: ExportedFilePreview, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-card border border-border/50 shadow-sm shrink-0">
                          {getFileIcon(file.format)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {file.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {file.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadSingleFile(file)}
                        title={`Download ${file.name}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-3.5 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-teal-800 dark:text-teal-200">
                  <Info className="w-4 h-4 shrink-0" />
                  How to use this with Tinkercad:
                </div>
                <p className="text-[11px] leading-relaxed">
                  1. Download the ZIP kit below and open the <strong>Wiring_Guide.pdf</strong>.
                  <br />
                  2. In Tinkercad Circuits, place the components listed in <strong>Components.csv</strong>.
                  <br />
                  3. Wire them up following the numbered steps and copy the sketch from <strong>Arduino_Sketch.ino</strong> into the Tinkercad Code editor.
                </p>
              </div>
            </div>
          ) : (
            /* Tab 2: Interactive Wiring Guide Checklist */
            <div className="space-y-4">
              {/* Progress Card */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Wiring Progress</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {completedCount} of {totalSteps} connections completed ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Steps List */}
              {bundle && bundle.summary.connections.length > 0 ? (
                <div className="space-y-2.5">
                  {bundle.summary.connections.map((conn: TinkercadConnection) => {
                    const isDone = completedSteps.has(conn.stepNumber);
                    return (
                      <div
                        key={conn.id}
                        onClick={() => toggleStep(conn.stepNumber)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isDone
                            ? "bg-teal-500/5 border-teal-500/30 opacity-75"
                            : "bg-background/60 border-border/80 hover:border-primary/50 shadow-sm"
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                            isDone
                              ? "bg-teal-600 text-white border-teal-600"
                              : "border-border text-transparent hover:border-teal-500"
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                              Step {conn.stepNumber}: {conn.description}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {conn.color} wire
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">
                              {conn.fromPartName} ({conn.fromPinLabel})
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {conn.toPartName} ({conn.toPinLabel})
                            </span>
                          </div>

                          {conn.checkpoint && (
                            <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md inline-block mt-1">
                              ✓ {conn.checkpoint}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No wires routed in this circuit yet. Add parts and connections on the canvas first!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-border/60 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground max-w-sm">
              Tinkercad does not support direct `.dez` file import. This kit provides physical pinouts and sketch code for rapid Tinkercad testing.
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="rounded-xl text-xs font-semibold"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadZip}
                disabled={!bundle || isGenerating}
                className="rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5"
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Downloaded!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Learning Kit (.zip)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
