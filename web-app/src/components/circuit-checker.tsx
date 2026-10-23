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
import { Button } from "./ui/button";
import { validateFile, cropRect } from "@/lib/demo.mjs";

export function CircuitChecker() {
  const [image, setImage] = useState(""),
    [name, setName] = useState(""),
    [crop, setCrop] = useState(100),
    [applied, setApplied] = useState(false),
    [status, setStatus] = useState<"idle" | "checking" | "done">("idle"),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    source = useRef(""),
    output = useRef(""),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      URL.revokeObjectURL(source.current);
      URL.revokeObjectURL(output.current);
    },
    [],
  );
  function clear() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
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
  function analyze() {
    if (!image || status === "checking") return;
    setStatus("checking");
    timer.current = setTimeout(() => setStatus("done"), 1800);
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <h1>Let’s look a little closer.</h1>
        <p>A dedicated space to untangle your circuit questions.</p>
      </div>
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
              disabled={!image || !!error || status === "checking"}
              onClick={analyze}
            >
              <ScanLine size={16} />
              {status === "checking" ? "Running demo…" : "Try demo review"}
            </Button>
          </div>
          <p className="small muted">
            Nothing is uploaded. Cropping happens on this device.
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
                Add your screenshot and try the review animation. Findings are
                illustrative and do not reflect your image.
              </p>
            </div>
          ) : status === "checking" ? (
            <div className="stack skeleton checking-skeleton" role="status">
              <p>Preparing example findings…</p>
              <span />
              <span />
              <span />
              <p className="small muted">
                Simulated review. No AI call is made.
              </p>
            </div>
          ) : (
            <div className="stack">
              <p className="notice">
                <strong>Illustrative findings only.</strong> These examples are
                the same for every image. Your circuit has not been analyzed.
              </p>
              {[
                "Check the LED polarity",
                "Confirm a series resistor",
                "Trace the return to ground",
              ].map((title, i) => (
                <div className="finding" key={title}>
                  <span className="icon-tile">
                    <Info size={18} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p className="muted">
                      {
                        [
                          "Find the anode and cathode. Check their orientation against your component datasheet.",
                          "An LED needs current limiting. Calculate a suitable resistance for your supply and LED.",
                          "Look for a complete current path, including breadboard row connections.",
                        ][i]
                      }
                    </p>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setStatus("idle")}>
                <RotateCcw size={15} />
                Clear example findings
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
