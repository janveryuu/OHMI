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
  Sparkles,
  Bot,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type { ElectronicsBridge, EngineStatus } from "@/lib/playground/bridge";
import {
  parseCircuitIntent,
  generateCircuit,
  type GeneratedCircuit,
} from "@/lib/playground/circuit-generator";
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
      // Stage 1: Plan created
      await new Promise((r) => setTimeout(r, 200));
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, stages: { ...t.stages, plan: true } }
            : t,
        ),
      );

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
        // Attempt modifying existing circuit
        const modResult = modifyExistingCircuit(currentSnapshot, text);
        if (modResult.success && modResult.document) {
          // Stage 2: Validated
          await new Promise((r) => setTimeout(r, 250));
          setTurns((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? { ...t, stages: { ...t.stages, validated: true } }
                : t,
            ),
          );

          // Stage 3: Apply to Canvas
          await new Promise((r) => setTimeout(r, 300));
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

      // New Circuit Generation
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

      const circuit = generateCircuit(intent);

      // Stage 2: Components & wiring validated
      await new Promise((r) => setTimeout(r, 250));
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, stages: { ...t.stages, validated: true } }
            : t,
        ),
      );

      // Stage 3: Building on canvas
      await new Promise((r) => setTimeout(r, 300));
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
        className={styles.floatingTrigger}
        onClick={onToggleCollapse}
        aria-label="Open Build with OHMI assistant"
      >
        <Image
          src="/app/mascot.png"
          alt=""
          width={22}
          height={26}
          className={styles.mascotIcon}
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
