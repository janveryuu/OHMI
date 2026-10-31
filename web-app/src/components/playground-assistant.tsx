"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Image from "next/image";
import {
  CircuitBoard,
  CheckCircle2,
  Circle,
  Loader2,
  Code,
  ArrowUp,
  Sidebar,
  Bot,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type { ElectronicsBridge, EngineStatus } from "@/lib/playground/bridge";
import {
  parseCircuitIntent,
  generateCircuit,
  validateCircuitAgainstRequirements,
  type GeneratedCircuit,
} from "@/lib/playground/circuit-generator";
import { validateElectronicsDocument } from "@/lib/playground/electronics-document";
import { validateCircuitSpec } from "@/lib/playground/circuit-spec";
import {
  isModificationRequest,
  modifyExistingCircuit,
} from "@/lib/playground/circuit-modifier";
import styles from "./playground-assistant.module.css";

export interface AssistantTurn {
  id: string;
  prompt: string;
  timestamp: number;
  building: boolean;
  stages: {
    plan: boolean;
    validated: boolean;
    built: boolean;
  };
  result?: {
    title: string;
    tag: string;
    code?: string;
    hasCode: boolean;
    isModification?: boolean;
    summary?: string;
  };
  error?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Blink an LED",
  "Build a traffic light",
  "Add a pushbutton",
  "6 LEDs Sequencer",
  "9V battery with switch",
];

export function PlaygroundAssistant({
  bridge,
  ready,
  busy,
  setBusy,
  onCircuitBuilt,
  isCollapsed,
  onToggleCollapse,
}: {
  bridge: React.RefObject<ElectronicsBridge | null>;
  ready: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCircuitBuilt?: (circuit: GeneratedCircuit) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [expandedCode, setExpandedCode] = useState<Record<string, boolean>>({});
  const [pendingConfirm, setPendingConfirm] = useState<{
    prompt: string;
    resolve: (confirm: boolean) => void;
  } | null>(null);

  // Floating pill draggable position & state
  const [pillOffset, setPillOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
    hasMoved: boolean;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initOffsetX: pillOffset.x,
      initOffsetY: pillOffset.y,
      hasMoved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragStartRef.current.hasMoved = true;
      setIsDragging(true);
    }
    if (dragStartRef.current.hasMoved) {
      setPillOffset({
        x: dragStartRef.current.initOffsetX + dx,
        y: dragStartRef.current.initOffsetY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    const hadMoved = dragStartRef.current.hasMoved;
    dragStartRef.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!hadMoved) {
      onToggleCollapse();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartRef.current && dragStartRef.current.pointerId === e.pointerId) {
      dragStartRef.current = null;
      setIsDragging(false);
    }
  };

  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll feed on new turns
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [turns, isBuilding]);

  const toggleCode = (turnId: string) => {
    setExpandedCode((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const handleBuild = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || isBuilding || !ready || !bridge.current) return;

    const turnId = crypto.randomUUID();
    const newTurn: AssistantTurn = {
      id: turnId,
      prompt: text,
      timestamp: Date.now(),
      building: true,
      stages: {
        plan: false,
        validated: false,
        built: false,
      },
    };

    setTurns((prev) => [...prev, newTurn]);
    setIsBuilding(true);
    setBusy(true);

    try {
      // Check if this is a modification of existing circuit
      const isMod = isModificationRequest(text);
      let currentSnapshot: Record<string, unknown> | null = null;

      try {
        currentSnapshot = await bridge.current.request<Record<string, unknown>>({
          operation: "snapshot",
        });
      } catch {}

      const hasExistingParts =
        Array.isArray(currentSnapshot?.parts) && currentSnapshot.parts.length > 0;

      if (isMod && hasExistingParts && currentSnapshot) {
        // Stage 1: Modification Plan created
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, stages: { ...t.stages, plan: true } } : t,
          ),
        );

        // Attempt modifying existing circuit
        const modResult = modifyExistingCircuit(currentSnapshot, text);
        if (modResult.success && modResult.document) {
          // Stage 2: Validated document
          validateElectronicsDocument(modResult.document);
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId ? { ...t, stages: { ...t.stages, validated: true } } : t,
            ),
          );

          // Stage 3: Apply to Canvas & Start Simulation
          await bridge.current.request({
            operation: "open",
            document: modResult.document,
          });

          await bridge.current
            .request({ operation: "zoom", direction: "fit" })
            .catch(() => {});

          await bridge.current
            .request({ operation: "running", running: true })
            .catch(() => {});

          const status = await bridge.current
            .request<EngineStatus>({ operation: "status" })
            .catch(() => null);

          if (!status?.ready) {
            throw new Error("Simulation engine failed to report ready state.");
          }

          if (onCircuitBuilt) {
            onCircuitBuilt({
              id: turnId,
              title: "Circuit Modified",
              tag: modResult.summary,
              promptText: text,
              wiring: [],
              arduinoCode: modResult.code || "",
              document: modResult.document,
              spec: {
                version: 1,
                status: "draft",
                title: "Circuit Modified",
                explanation: modResult.summary,
                warnings: [],
                parts: [],
                connections: [],
              },
              intent: {
                isCircuitRequest: true,
                circuitType: "modification",
                controller: "arduino",
                ledCount: 1,
                colors: ["Red"],
                hasBattery: false,
                batteryVoltage: "5V",
                hasSwitch: true,
                resistorOhms: 220,
                behavior: "chaser",
                rawPrompt: text,
              },
            });
          }

          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    building: false,
                    stages: { ...t.stages, built: true },
                    result: {
                      title: "Circuit Modified",
                      tag: modResult.summary,
                      code: modResult.code,
                      hasCode: Boolean(modResult.code),
                      isModification: true,
                      summary: modResult.summary,
                    },
                  }
                : t,
            ),
          );
          return;
        } else {
          throw new Error(modResult.summary || "Failed to modify existing circuit.");
        }
      }

      // Check if user should confirm replacing existing circuit
      if (hasExistingParts && !isMod) {
        const confirmed = await new Promise<boolean>((resolve) => {
          setPendingConfirm({ prompt: text, resolve });
        });
        setPendingConfirm(null);
        if (!confirmed) {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? {
                    ...t,
                    building: false,
                    error: "Build cancelled to preserve current circuit.",
                  }
                : t,
            ),
          );
          return;
        }
      }

      // New Circuit Generation Pipeline
      const intent = parseCircuitIntent(text);
      if (!intent.isCircuitRequest) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  building: false,
                  error:
                    "I couldn't identify circuit components in your request. Try asking to build an Arduino with LEDs, a battery circuit, or a pushbutton!",
                }
              : t,
          ),
        );
        return;
      }

      // Stage 1: Verified Circuit Plan Created
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, stages: { ...t.stages, plan: true } } : t,
        ),
      );

      const circuit = generateCircuit(intent);

      // Stage 2: Components & wiring strictly validated against requirements & electronics spec
      validateElectronicsDocument(circuit.document);
      validateCircuitSpec(circuit.spec);
      const reqCheck = validateCircuitAgainstRequirements(circuit, intent);
      if (!reqCheck.valid) {
        throw new Error("Circuit validation failed: " + reqCheck.errors.join("; "));
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, stages: { ...t.stages, validated: true } } : t,
        ),
      );

      // Stage 3: Building on canvas & verifying simulation
      await bridge.current.request({
        operation: "open",
        document: circuit.document,
      });

      await bridge.current
        .request({ operation: "zoom", direction: "fit" })
        .catch(() => {});

      await bridge.current
        .request({ operation: "running", running: true })
        .catch(() => {});

      const status = await bridge.current
        .request<EngineStatus>({ operation: "status" })
        .catch(() => null);

      if (!status?.ready) {
        throw new Error("Simulation engine failed to report ready state.");
      }

      if (onCircuitBuilt) {
        onCircuitBuilt(circuit);
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                building: false,
                stages: { ...t.stages, built: true },
                result: {
                  title: circuit.title,
                  tag: circuit.tag,
                  code: circuit.arduinoCode,
                  hasCode: Boolean(circuit.arduinoCode),
                  isModification: false,
                },
              }
            : t,
        ),
      );
    } catch (err) {
      console.error("Playground assistant build failed:", err);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                building: false,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to build circuit on canvas.",
              }
            : t,
        ),
      );
    } finally {
      setIsBuilding(false);
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBuilding) return;
    const promptText = input.trim();
    setInput("");
    void handleBuild(promptText);
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        className={`${styles.floatingTrigger} ${isDragging ? styles.dragging : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          transform: `translate3d(${pillOffset.x}px, ${pillOffset.y}px, 0)`,
        }}
        aria-label="Open Build with OHMI assistant (Drag to reposition)"
        title="Click to open or drag to reposition"
      >
        <Image
          src="/app/mascot.png"
          alt=""
          width={20}
          height={24}
          className={styles.mascotIcon}
          draggable={false}
        />
        <span>Build with OHMI</span>
      </button>
    );
  }

  return (
    <aside className={styles.assistantPanel} aria-label="Build with OHMI assistant">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Image
            src="/app/mascot.png"
            alt="OHMI Mascot"
            width={24}
            height={28}
            className={styles.mascotIcon}
          />
          <div className={styles.headerTitles}>
            <h2 className={styles.headerTitle}>Build with OHMI</h2>
            <p className={styles.headerSubtitle}>Your little circuit-building companion.</p>
          </div>
        </div>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapse}
          title="Collapse panel"
          aria-label="Collapse assistant panel"
        >
          <Sidebar size={16} />
        </button>
      </div>

      {/* Feed */}
      <div ref={feedRef} className={styles.feed}>
        {turns.length === 0 ? (
          <div className={styles.welcomeCard}>
            <div className={styles.welcomeHeader}>
              <Bot size={16} className="text-primary" />
              <span>Ready to build circuits!</span>
            </div>
            <p className={styles.welcomeText}>
              Describe any Arduino or battery circuit, and I’ll generate the parts, wire them
              cleanly on your canvas, write the code, and start the simulation.
            </p>
          </div>
        ) : null}

        {turns.map((turn) => (
          <div key={turn.id} className={styles.turnCard}>
            <div className={styles.studentBlock}>
              <span className={styles.studentLabel}>Student</span>
              <p className={styles.studentText}>{turn.prompt}</p>
            </div>

            {/* Progress checklist */}
            <div className={styles.progressList}>
              <div
                className={styles.progressItem}
                data-status={turn.stages.plan ? "done" : "pending"}
              >
                {turn.stages.plan ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <Circle size={14} />
                )}
                <span>Circuit plan created</span>
              </div>

              <div
                className={styles.progressItem}
                data-status={turn.stages.validated ? "done" : "pending"}
              >
                {turn.stages.validated ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <Circle size={14} />
                )}
                <span>Components and wiring validated</span>
              </div>

              <div
                className={styles.progressItem}
                data-status={
                  turn.stages.built
                    ? "done"
                    : turn.building
                      ? "active"
                      : "pending"
                }
              >
                {turn.stages.built ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : turn.building ? (
                  <Loader2 size={14} className="animate-spin text-primary" />
                ) : (
                  <Circle size={14} />
                )}
                <span>
                  {turn.stages.built
                    ? "Circuit built & simulation running"
                    : "Building on canvas..."}
                </span>
              </div>
            </div>

            {/* Result summary card */}
            {turn.result && (
              <div className={styles.resultCard}>
                <div className={styles.resultHeader}>
                  <CircuitBoard size={16} className="text-primary" />
                  <span className={styles.resultTitle}>{turn.result.title}</span>
                </div>
                <p className={styles.resultTag}>{turn.result.tag}</p>
                <div className={styles.badgesRow}>
                  <span className={`${styles.badge} ${styles.badgeActive}`}>Editable</span>
                  {turn.result.hasCode && (
                    <span className={styles.badge}>Code included</span>
                  )}
                </div>

                {turn.result.code && (
                  <>
                    <button
                      type="button"
                      className={styles.codeToggleBtn}
                      onClick={() => toggleCode(turn.id)}
                    >
                      <Code size={13} />
                      <span>
                        {expandedCode[turn.id]
                          ? "Hide Arduino Code"
                          : "View Arduino Code"}
                      </span>
                    </button>
                    {expandedCode[turn.id] && (
                      <div className={styles.codePanel}>
                        <pre>
                          <code>{turn.result.code}</code>
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Error banner */}
            {turn.error && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle size={14} className="shrink-0" />
                <span>{turn.error}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Dialog Overlay */}
      {pendingConfirm && (
        <div className={styles.confirmDialog} role="dialog" aria-modal="true">
          <div className={styles.confirmBox}>
            <h3 className={styles.confirmTitle}>Replace current circuit?</h3>
            <p className={styles.confirmText}>
              Your current canvas has existing components. Building &ldquo;{pendingConfirm.prompt}&rdquo; will replace the current circuit. You can always use Undo.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnCancel}`}
                onClick={() => pendingConfirm.resolve(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnPrimary}`}
                onClick={() => pendingConfirm.resolve(true)}
              >
                Replace & Build
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer input & suggestions */}
      <div className={styles.footer}>
        <div className={styles.chipsScroll} role="region" aria-label="Circuit suggestions">
          {DEFAULT_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              className={styles.chipBtn}
              disabled={isBuilding || !ready}
              onClick={() => void handleBuild(sug)}
            >
              {sug}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className={styles.inputBar}>
          <input
            type="text"
            className={styles.inputField}
            placeholder="Ask OHMI to build something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isBuilding || !ready}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || isBuilding || !ready}
            aria-label="Send circuit build request"
          >
            {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
          </button>
        </form>
      </div>
    </aside>
  );
}
