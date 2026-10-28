"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Crop,
  ImagePlus,
  Info,
  RotateCcw,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "./app-provider";
import { askBackend } from "@/lib/backend/ai";
import { RichText } from "./rich-text";
import { Button } from "./ui/button";
import { AsyncStatusCard } from "./ui/async-status-card";
import { validateFile, cropRect } from "@/lib/demo.mjs";

type CheckerStage =
  | "preparing_image"
  | "validating_evidence"
  | "analyzing_circuit"
  | "preparing_feedback";

const CHECKER_STAGES = [
  {
    id: "preparing_image",
    label: "Preparing image",
    detail: "Reading cropped pixels & verifying resolution",
  },
  {
    id: "validating_evidence",
    label: "Validating evidence",
    detail: "Checking byte boundaries & AI service availability",
  },
  {
    id: "analyzing_circuit",
    label: "Analyzing circuit",
    detail: "Tracing visible wires, connections & component placement",
  },
  {
    id: "preparing_feedback",
    label: "Preparing feedback",
    detail: "Structuring findings and safe step-by-step guidance",
  },
];

export function CircuitChecker() {
  const app = useApp();
  const [result, setResult] = useState<Record<string, unknown> | null>(null),
    [code, setCode] = useState(""),
    [requirements, setRequirements] = useState("");
  const request = useRef<AbortController | null>(null),
    retry = useRef<{ key: string; id: string } | null>(null);
  const [image, setImage] = useState(""),
    [name, setName] = useState(""),
    [crop, setCrop] = useState(100),
    [applied, setApplied] = useState(false),
    [status, setStatus] = useState<"idle" | "checking" | "done" | "error">(
      "idle",
    ),
    [stage, setStage] = useState<CheckerStage>("preparing_image"),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    source = useRef(""),
    output = useRef(""),
    generation = useRef(0),
    original = useRef<File | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      URL.revokeObjectURL(source.current);
      URL.revokeObjectURL(output.current);
    },
    [],
  );
  function clear() {
    generation.current++;
    request.current?.abort();
    setResult(null);
    retry.current = null;
    URL.revokeObjectURL(source.current);
    URL.revokeObjectURL(output.current);
    source.current = "";
    output.current = "";
    setImage("");
    setName("");
    setCrop(100);
    setApplied(false);
    setStatus("idle");
    setError("");
  }
  function load(file: File | undefined) {
    if (!file) return;
    clear();
    const issue = validateFile(file);
    if (issue || !file.type.startsWith("image/")) {
      setError(issue || "Choose a PNG or JPEG screenshot for circuit review.");
      return;
    }
    original.current = file;
    source.current = URL.createObjectURL(file);
    setImage(source.current);
    setName(file.name);
  }
  async function applyCrop() {
    setError("");
    const current = ++generation.current;
    try {
      const img = new Image();
      img.src = source.current;
      await img.decode();
      if (current !== generation.current) return;
      const rect = cropRect(img.naturalWidth, img.naturalHeight, crop);
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(
        img,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height,
      );
      canvas.toBlob((blob) => {
        if (current !== generation.current) return;
        if (!blob) {
          setError("Could not crop this image. Try another PNG or JPEG.");
          return;
        }
        URL.revokeObjectURL(output.current);
        output.current = URL.createObjectURL(blob);
        setImage(output.current);
        setApplied(true);
      }, "image/png");
    } catch {
      if (current === generation.current)
        setError("This image could not be opened. Choose another PNG or JPEG.");
    }
  }
  useEffect(() => {
    clear();
    setCode("");
    setRequirements("");
  }, [app.user?.id]);
  async function analyze() {
    if (!image || status === "checking") return;
    if (!app.user) {
      setError("Sign in to review a circuit and save findings.");
      return;
    }
    const current = ++generation.current,
      controller = new AbortController();
    request.current = controller;
    setStatus("checking");
    setStage("preparing_image");
    setError("");
    try {
      const blob = await fetch(image).then((r) => r.blob());
      const img = new Image();
      img.src = image;
      await img.decode();
      if (
        blob.size > 3 * 1024 * 1024 ||
        img.naturalWidth * img.naturalHeight > 4_000_000
      )
        throw new Error(
          "Choose an image up to 3 MB and 4 megapixels, or apply a smaller crop.",
        );
      let uploadBlob = blob;
      if (img.naturalWidth > 1920 || img.naturalHeight > 1920) {
        const scale = 1920 / Math.max(img.naturalWidth, img.naturalHeight);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const scaled = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, blob.type === "image/jpeg" ? "image/jpeg" : "image/png"),
          );
          if (scaled) uploadBlob = scaled;
        }
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Image could not be read."));
        reader.readAsDataURL(uploadBlob);
      });
      if (current !== generation.current) return;

      setStage("validating_evidence");
      const availability = await fetch("/app/api/ai/", {
        cache: "no-store",
        signal: controller.signal,
      }).then((r) => r.json());
      if (!availability.enabled)
        throw new Error(
          "AI tutoring is paused until free-only provider access is verified.",
        );
      if (current !== generation.current) return;

      setStage("analyzing_circuit");
      const payload = {
        version: 2,
        operation: "circuit_check",
        language: app.language.toLowerCase(),
        mode: "check",
        message:
          "Review the visible circuit. Explain uncertainty and safe next steps.",
        images: [{ id: "overview", mimeType: blob.type, data }],
        board: "unknown",
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(requirements.trim()
          ? { requirementText: requirements.trim() }
          : {}),
      };
      const key = JSON.stringify(payload),
        requestId =
          retry.current?.key === key ? retry.current.id : crypto.randomUUID();
      retry.current = { key, id: requestId };
      const response = await askBackend(
        { ...payload, requestId },
        controller.signal,
      );
      if (current !== generation.current) return;

      setStage("preparing_feedback");
      setResult(response.result);
      setStatus("done");
      await app.refresh();
    } catch (cause) {
      if (
        cause &&
        typeof cause === "object" &&
        "terminal" in cause &&
        cause.terminal === true
      )
        retry.current = null;
      if (current === generation.current) {
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "Review did not finish. Check saved results before retrying.",
        );
      }
    }
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <h1>Let’s look a little closer.</h1>
        <p>A dedicated space to untangle your circuit questions.</p>
      </div>
      {app.analyses.filter((a) => a.artifact_kind === "circuit_check").length >
        0 && (
        <details className="panel">
          <summary>Saved circuit reviews</summary>
          {app.analyses
            .filter((a) => a.artifact_kind === "circuit_check")
            .map((a) => (
              <details key={a.id}>
                <summary>
                  {a.title || "Circuit review"} ·{" "}
                  {new Date(a.created_at).toLocaleDateString()}
                </summary>
                <CircuitResult result={a.payload} />
              </details>
            ))}
        </details>
      )}
      <div className="checker-layout">
        <section className="panel stack">
          <div className="between">
            <h2>Your circuit workspace</h2>
            <span className="badge">Local preview</span>
          </div>
          {!image ? (
            <button
              className="checker-drop"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                load(e.dataTransfer.files[0]);
              }}
            >
              <span className="icon-tile">
                <ImagePlus size={28} />
              </span>
              <h3>Bring your circuit into focus.</h3>
              <span className="muted">
                Choose or drop a PNG or JPEG screenshot.
              </span>
              <span className="badge">Up to 10 MB</span>
            </button>
          ) : (
            <>
              <div className="circuit-image-wrap">
                <img
                  src={image}
                  alt={`Circuit screenshot: ${name}`}
                  onError={() =>
                    setError(
                      "This file is not a readable image. Choose another PNG or JPEG.",
                    )
                  }
                  style={
                    !applied
                      ? { clipPath: `inset(${(100 - crop) / 2}%)` }
                      : undefined
                  }
                />
                {!applied && crop < 100 && (
                  <div
                    className="crop-boundary"
                    style={{ inset: `${(100 - crop) / 2}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="between">
                <span className="file-name muted small">{name}</span>
                <Button variant="ghost" onClick={clear}>
                  <X size={15} />
                  Remove
                </Button>
              </div>
              <div className="crop-controls">
                <label className="field" htmlFor="crop">
                  Centered crop{" "}
                  <span className="small muted">
                    Keep {crop}% of the original frame. Use arrow keys to
                    adjust.
                  </span>
                </label>
                <input
                  id="crop"
                  type="range"
                  min="25"
                  max="100"
                  value={crop}
                  disabled={applied || status === "checking"}
                  onChange={(e) => setCrop(Number(e.target.value))}
                />
                <div className="row">
                  <Button
                    variant="outline"
                    disabled={applied || status === "checking"}
                    onClick={applyCrop}
                  >
                    <Crop size={15} />
                    {applied ? "Crop applied" : "Apply crop"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={status === "checking"}
                    onClick={() => {
                      generation.current++;
                      setImage(source.current);
                      setCrop(100);
                      setApplied(false);
                      setStatus("idle");
                    }}
                  >
                    <RotateCcw size={15} />
                    Reset crop
                  </Button>
                </div>
              </div>
            </>
          )}
          <input
            type="file"
            hidden
            ref={input}
            accept=".png,.jpg,.jpeg"
            onChange={(e) => {
              load(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            Arduino code (optional)
            <textarea
              className="input"
              maxLength={12000}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="field">
            Assignment requirements (optional)
            <textarea
              className="input"
              maxLength={4000}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </label>
          <div className="row checker-actions">
            <Button
              variant="outline"
              onClick={() => input.current?.click()}
              disabled={status === "checking"}
            >
              <Upload size={16} />
              {image ? "Replace image" : "Choose screenshot"}
            </Button>
            <Button
              disabled={!image || status === "checking"}
              onClick={analyze}
            >
              <ScanLine size={16} />
              {status === "checking" ? "Reviewing…" : "Review circuit"}
            </Button>
          </div>
          <p className="small muted">
            Cropping stays on your device. Review sends the selected image and
            optional text to OHMI’s AI service.
          </p>
        </section>
        <section className="panel findings-panel" aria-live="polite">
          <div className="section-title between">
            <h2>A second pair of eyes</h2>
            <ScanLine size={19} />
          </div>
          {status === "idle" ? (
            <div className="empty">
              <span className="icon-tile">
                <ScanLine size={28} />
              </span>
              <h3>Ready for a closer look?</h3>
              <p>
                Add your screenshot. OHMI reviews visible evidence and records
                uncertainty.
              </p>
            </div>
          ) : status === "checking" ? (
            <AsyncStatusCard
              title="Reviewing circuit evidence"
              subtitle="OHMI is examining visible components and connections."
              stages={CHECKER_STAGES}
              currentStageId={stage}
              thumbnailUrl={image}
              thumbnailAlt={`Circuit: ${name}`}
              status="loading"
              onCancel={() => {
                generation.current++;
                request.current?.abort();
                setStatus("idle");
                setError("Review paused. Your screenshot remains loaded.");
              }}
            />
          ) : status === "error" ? (
            <AsyncStatusCard
              title="Circuit review incomplete"
              subtitle="Check the issue below before retrying."
              stages={CHECKER_STAGES}
              currentStageId={stage}
              thumbnailUrl={image}
              thumbnailAlt={`Circuit: ${name}`}
              status="error"
              error={error}
              onRetry={analyze}
              onCancel={() => {
                setStatus("idle");
                setError("");
              }}
            />
          ) : (
            <div className="stack">
              {result && <CircuitResult result={result} />}
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setStatus("idle");
                }}
              >
                Clear findings
              </Button>
            </div>
          )}
          <div className="review-note">
            <Check size={16} />
            <p>
              A screenshot can suggest questions. It cannot electrically verify
              a circuit.
            </p>
          </div>
          <Link href="/guide" className="text-link">
            Build the LED example
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}

function CircuitResult({ result }: { result: Record<string, unknown> }) {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return (
    <div className="stack">
      <RichText text={text(result.summary)} />
      {Array.isArray(result.findings) &&
        result.findings.map((f: Record<string, unknown>, i: number) => (
          <div className="finding" key={i}>
            <div>
              <span className="badge">
                {text(f.severity)} · {text(f.certainty)}
              </span>
              <RichText
                text={[f.observation, f.why, f.action].map(text).join("\n\n")}
              />
            </div>
          </div>
        ))}
      {["unknowns", "questions", "limitations"].map(
        (key) =>
          Array.isArray(result[key]) && (
            <div key={key}>
              <h3>{key}</h3>
              <ul>
                {(result[key] as unknown[]).map((item, i) => (
                  <li key={i}>{text(item)}</li>
                ))}
              </ul>
            </div>
          ),
      )}
      {Array.isArray(result.steps) &&
        result.steps.map((item: Record<string, unknown>, i: number) => (
          <RichText
            key={i}
            text={[item.instruction, item.why, item.check]
              .map(text)
              .join("\n\n")}
          />
        ))}
    </div>
  );
}
