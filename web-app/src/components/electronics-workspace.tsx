"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ElectronicsBridge, type EngineRequest } from "@/lib/playground/bridge";
import { useElectronicsProject } from "@/lib/playground/use-electronics-project";
import styles from "./electronics-workspace.module.css";
import { ElectronicsTools } from "./electronics-tools";
import type { EngineStatus } from "@/lib/playground/bridge";
import { validateCircuitBuildResult } from "@/lib/playground/circuit-spec";
import { validateElectronicsDocument } from "@/lib/playground/electronics-document";
import { getTrafficLightElectronicsDocument } from "@/lib/playground/traffic-light-template";

const ENGINE_DOCUMENT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OHMI electronics engine</title>
  <link rel="stylesheet" href="/app/vendor/design-electronics/engine.css">
</head>
<body>
  <img id="ohmi-toolbar-logo" src="/app/mascot.png" alt="OHMI" hidden>
  <canvas id="canvas" tabindex="0" aria-label="Electronics editor. Use the OHMI controls outside this frame for keyboard actions."></canvas>
  <p id="status" role="status">Loading electronics engine…</p>
  <script type="module" src="/app/vendor/design-electronics/loader.mjs"></script>
</body>
</html>`;

export function ElectronicsWorkspace({
  buildId,
  initialTemplate,
}: {
  buildId?: string;
  initialTemplate?: string;
}) {
  const { user } = useApp();
  return (
    <Editor
      key={user?.id || "guest"}
      accountId={user?.id || ""}
      buildId={buildId}
      initialTemplate={initialTemplate}
    />
  );
}

function Editor({
  accountId,
  buildId,
  initialTemplate,
}: {
  accountId: string;
  buildId?: string;
  initialTemplate?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ElectronicsBridge | null>(null);
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaveOpen,setLeaveOpen]=useState(false);
  const leaveAction=useRef<(()=>void)|null>(null);
  const [canvasFocus, setCanvasFocus] = useState(false);
  const focusButton = useRef<HTMLButtonElement>(null),
    focusBand = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canvasFocus)
      requestAnimationFrame(() => {
        focusBand.current?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
        frame.current?.focus();
      });
  }, [canvasFocus]);
  const lastLoadedTemplate = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !bridge.current) return;

    // Check for custom dynamically generated circuit from Ask OHMI
    let customDoc: Record<string, unknown> | null = null;
    try {
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("ohmi_active_circuit_doc") : null;
      if (stored) {
        customDoc = validateElectronicsDocument(JSON.parse(stored));
        sessionStorage.removeItem("ohmi_active_circuit_doc");
      }
    } catch (err) {
      console.warn("Failed to parse custom circuit document:", err);
    }

    if (customDoc) {
      lastLoadedTemplate.current = "custom";
      const doc = customDoc;
      bridge.current
        ?.request({ operation: "open", document: doc })
        .then(async () => {
          cloud.detach();
          await bridge.current
            ?.request({ operation: "zoom", direction: "fit" })
            .catch(() => {});
          setTimeout(() => {
            bridge.current
              ?.request({ operation: "zoom", direction: "fit" })
              .catch(() => {});
          }, 150);
          await bridge.current
            ?.request({ operation: "running", running: true })
            .catch(() => {});
          const status = await bridge.current
            ?.request<EngineStatus>({ operation: "status" })
            .catch(() => null);
          if (status) setEngineState(status);
          setMessage(
            `${doc.title || "Custom circuit"} loaded. Simulation running.`,
          );
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load custom circuit",
          );
        });
      return;
    }
    let templateName: string | null = initialTemplate || null;
    if (!templateName && typeof window !== "undefined") {
      try {
        const search = new URLSearchParams(window.location.search);
        templateName =
          search.get("template") ||
          search.get("circuit") ||
          sessionStorage.getItem("ohmi_playground_template");
      } catch {}
    }
    const isArduinoTrafficTemplate =
      templateName === "arduino-traffic-light" ||
      templateName === "traffic-light" ||
      templateName === "arduino" ||
      templateName === "arduino-uno" ||
      (typeof templateName === "string" &&
        (templateName.toLowerCase().includes("traffic") ||
          templateName.toLowerCase().includes("arduino")));

    if (
      isArduinoTrafficTemplate &&
      lastLoadedTemplate.current !== templateName
    ) {
      lastLoadedTemplate.current = templateName;
      try {
        sessionStorage.removeItem("ohmi_playground_template");
        sessionStorage.removeItem("ohmi_playground_active_template");
      } catch {}
      const doc = getTrafficLightElectronicsDocument();
      bridge.current
        ?.request({ operation: "open", document: doc })
        .then(async () => {
          cloud.detach();
          await bridge.current
            ?.request({ operation: "zoom", direction: "fit" })
            .catch(() => {});
          setTimeout(() => {
            bridge.current
              ?.request({ operation: "zoom", direction: "fit" })
              .catch(() => {});
          }, 150);
          await bridge.current
            ?.request({ operation: "running", running: true })
            .catch(() => {});
          const status = await bridge.current
            ?.request<EngineStatus>({ operation: "status" })
            .catch(() => null);
          if (status) setEngineState(status);
          setMessage(
            "Arduino Traffic Light circuit loaded. Red (pin 8), Yellow (pin 9), Green (pin 10) connected with 330 Ω resistors. Simulation running.",
          );
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Failed to load template",
          );
        });
    }
  }, [ready, initialTemplate]);
  const [engineState, setEngineState] = useState<Pick<
    EngineStatus,
    "running" | "view"
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Loading the local electronics engine…",
  );
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const cloud = useElectronicsProject(bridge, ready, accountId);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      bridge.current
        ?.request<EngineStatus>({ operation: "status" })
        .then((status) => {
          if (active) setEngineState(status);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready]);
  const [observations, setObservations] = useState<
    { time: number; leds: Record<string, number> }[]
  >([]);
  const [buildWarnings, setBuildWarnings] = useState<string[]>([]);
  const buildAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      buildAbort.current?.abort();
    },
    [],
  );
  async function openBuild() {
    if (!buildId || !bridge.current || busy || cloud.busy) return;
    const session = bridge.current,
      abort = new AbortController();
    buildAbort.current = abort;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/app/api/playground/build/?id=" + encodeURIComponent(buildId),
        {
          headers: { "x-ohmi-account": accountId },
          cache: "no-store",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Build unavailable.");
      if (
        data.accountId !== accountId ||
        data.requestId !== buildId ||
        data.status !== "completed"
      )
        throw new Error(
          "This build is not complete for your account. Check its status in Ask OHMI.",
        );
      const result = validateCircuitBuildResult(data.result);
      if (result.status !== "draft") throw new Error(result.answer);
      if (abort.signal.aborted || bridge.current !== session) return;
      setBuildWarnings(result.circuitSpec.warnings);
      if (
        !window.confirm(
          [
            "Open a new AI draft? Download your current circuit first. Undo can restore this local circuit; saved projects stay unchanged.",
            ...result.circuitSpec.warnings.map(
              (warning) => "Planner caveat: " + warning,
            ),
          ].join("\n\n"),
        )
      )
        return;
      const compiled = await session.request<{
        document: unknown;
        observations: {
          samples: {
            time: number;
            leds: Record<string, number>;
            errors: unknown[];
            warnings: unknown[];
            damaged: unknown[];
          }[];
        };
      }>({ operation: "compile", spec: result.circuitSpec });
      const document = validateElectronicsDocument(compiled.document);
      if (
        !compiled.observations.samples.length ||
        compiled.observations.samples.some(
          (sample) =>
            sample.errors.length ||
            sample.warnings.length ||
            sample.damaged.length,
        )
      )
        throw new Error(
          "The engine reported a sketch or circuit problem. Your active circuit is unchanged.",
        );
      if (abort.signal.aborted || bridge.current !== session) return;
      await session.request({ operation: "open", document });
      cloud.detach();
      setObservations(compiled.observations.samples);
      setMessage(
        "New editable draft opened. Engine sampled 4 seconds without reported errors, warnings or damage. This does not verify hardware or prove your full requirements. Save a separate private copy or download .dez and .ino.",
      );
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Build could not be opened.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  async function downloadSketches() {
    const document = await perform<{
      parts: { type: string; id: number; code?: string }[];
    }>({ operation: "snapshot" });
    if (!document) return;
    const boards = document.parts.filter(
      (part) => part.type.startsWith("arduino_") && part.code,
    );
    if (!boards.length) {
      setError("No Arduino sketch in this circuit.");
      return;
    }
    for (const board of boards) {
      const url = URL.createObjectURL(
          new Blob([board.code!], { type: "text/plain;charset=utf-8" }),
        ),
        anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = "ohmi-board-" + board.id + ".ino";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  useEffect(() => {
    let leaving = false;
    const location = window.location.href;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving) event.preventDefault();
    };
    const link = (event: MouseEvent) => {
      if(leaving)return;
      const anchor = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        anchor.href.split("#")[0] === location.split("#")[0]
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveAction.current=()=>{leaving=true;anchor.click();};
      setLeaveOpen(true);
    };
    // A same-URL history entry lets Back be canceled before Next unmounts the editor.
    const guard = () =>
      window.history.pushState(
        { ...window.history.state, ohmiEngineGuard: true },
        "",
        location,
      );
    if (!window.history.state?.ohmiEngineGuard) guard();
    const back = (event: PopStateEvent) => {
      if (leaving) return;
      event.stopImmediatePropagation();
      guard();
      leaveAction.current=()=>{leaving=true;window.history.go(-2);};
      setLeaveOpen(true);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", link, true);
    window.addEventListener("popstate", back, true);
    return () => {
      bridge.current?.close();
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", link, true);
      window.removeEventListener("popstate", back, true);
    };
  }, []);

  const connect = () => {
    bridge.current?.close();
    if (!frame.current) return;
    const session = new ElectronicsBridge(
      frame.current,
      (status) => {
        setReady(true);
        setEngineState(status);
        setError("");
        setMessage(
          `${status.catalogCount} native parts available. Save a private snapshot or download .dez to keep changes.`,
        );
        const syncTheme = () =>
          session
            .request({
              operation: "theme",
              theme:
                document.documentElement.dataset.theme === "dark"
                  ? "dark"
                  : "light",
            })
            .catch(() => {});
        syncTheme();
      },
      (reason) => {
        setReady(false);
        setError(reason);
      },
    );
    bridge.current = session;
  };

  useEffect(() => {
    const observer = new MutationObserver(() => {
      bridge.current
        ?.request({
          operation: "theme",
          theme:
            document.documentElement.dataset.theme === "dark"
              ? "dark"
              : "light",
        })
        .catch(() => {});
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  async function perform<T>(request: EngineRequest): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const result = await bridge.current?.request<T>(request);
      if (bridge.current)
        setEngineState(
          await bridge.current.request<EngineStatus>({ operation: "status" }),
        );
      return result;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The operation failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    const document = await perform({ operation: "snapshot" });
    if (!document) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = "ohmi-circuit.dez";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Downloaded your editable .dez circuit. Keep this file to reopen your work.",
    );
  }
  async function open(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > 1024 * 1024) {
      setError("Choose a .dez file smaller than 1 MiB.");
      return;
    }
    if (
      !window.confirm(
        "Replace this local circuit? Download your current work first if you want to keep it.",
      )
    )
      return;
    try {
      const document = JSON.parse(await selected.text());
      if (await perform({ operation: "open", document })) {
        cloud.detach();
        setMessage(
          "Circuit opened. Save a private copy or download it after editing to keep changes.",
        );
      }
    } catch {
      setError(
        "This file is not valid JSON. Choose a designElectronics .dez file.",
      );
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="electronics-title">
      <Dialog open={leaveOpen} onOpenChange={value=>{setLeaveOpen(value);if(!value)leaveAction.current=null;}}>
        <DialogContent showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();document.getElementById('stay-in-playground')?.focus();}}>
          <img src="/app/mascot.png" alt="" width={56} height={64} style={{objectFit:'contain',imageRendering:'pixelated'}}/>
          <DialogTitle>Keep your bright ideas safe.</DialogTitle>
          <DialogDescription>Leaving the Playground? Save a private snapshot or download your .dez circuit first. Unsaved changes will be lost.</DialogDescription>
          <div className={styles.group}>
            <Button id="stay-in-playground" onClick={()=>{leaveAction.current=null;setLeaveOpen(false);}}>Keep building</Button>
            <Button variant="outline" onClick={()=>{const action=leaveAction.current;leaveAction.current=null;setLeaveOpen(false);action?.();}}>Leave Playground</Button>
          </div>
        </DialogContent>
      </Dialog>
      <header className={styles.header}>
        <div>
          <h1 id="electronics-title">Electronics workspace</h1>
          <p>Interactive circuit workspace</p>
        </div>
        <Button
          ref={focusButton}
          variant="outline"
          disabled={!ready || busy || cloud.busy}
          onClick={() => setCanvasFocus(true)}
        >
          Focus canvas
        </Button>
      </header>

      {buildId && (
        <Button
          disabled={!ready || busy || cloud.busy}
          onClick={() => void openBuild()}
        >
          Open requested AI draft
        </Button>
      )}
      {buildWarnings.length > 0 && (
        <ul aria-label="Planner caveats">
          {buildWarnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <div className={styles.toolbar} aria-label="Circuit controls">
        <div className={styles.group} aria-label="Circuit view">
          {["Breadboard", "Schematic", "PCB"].map((name, view) => (
            <Button
              key={name}
              variant="outline"
              aria-pressed={engineState?.view === view}
              disabled={!ready || busy || cloud.busy}
              onClick={() => perform({ operation: "view", view })}
            >
              {name}
            </Button>
          ))}
        </div>
        <div className={styles.group}>
          <Button
            disabled={!ready || busy || cloud.busy}
            onClick={() => perform({ operation: "running", running: true })}
          >
            Run
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={() => perform({ operation: "running", running: false })}
          >
            Stop
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={() => perform({ operation: "undo" })}
          >
            Undo
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={() => perform({ operation: "redo" })}
          >
            Redo
          </Button>
        </div>
        <ElectronicsTools
          bridge={bridge}
          disabled={!ready || busy || cloud.busy}
          onBusy={setBusy}
        />
        <div className={styles.group} aria-label="Canvas zoom">
          {(
            [
              ["out", "Zoom out"],
              ["fit", "Fit circuit"],
              ["in", "Zoom in"],
            ] as const
          ).map(([direction, name]) => (
            <Button
              key={direction}
              variant="outline"
              disabled={!ready || busy || cloud.busy}
              onClick={() => perform({ operation: "zoom", direction })}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
      <p role="status" className={styles.status}>
        <strong>
          {!ready
            ? "Engine loading"
            : engineState?.running
              ? "Simulation running"
              : "Simulation paused"}
        </strong>
        {" · "}
        {message}
      </p>
      {observations.length > 0 && (
        <details className={styles.projects}>
          <summary>Engine observations from the opened draft</summary>
          <p>
            Captured before opening, not live after edits. Brightness is a
            simulator value from 0 (off) to 1 (full). This is not hardware
            verification.
          </p>
          <div
            className={styles.observations}
            tabIndex={0}
            role="region"
            aria-label="Four-second engine timeline"
          >
            <table>
              <caption>Four seconds, sampled every 50 ms</caption>
              <thead>
                <tr>
                  <th scope="col">Time (s)</th>
                  <th scope="col">LED native ID: brightness</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((sample) => (
                  <tr key={sample.time}>
                    <td>{sample.time.toFixed(2)}</td>
                    <td>
                      {Object.entries(sample.leds)
                        .map(([id, value]) => id + ": " + value.toFixed(3))
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {canvasFocus && (
        <div ref={focusBand} className={styles.focusBand}>
          <Button
            variant="outline"
            onClick={() => {
              setCanvasFocus(false);
              requestAnimationFrame(() => {
                focusButton.current?.scrollIntoView({
                  block: "center",
                  behavior: "instant",
                });
                focusButton.current?.focus();
              });
            }}
          >
            Return to controls
          </Button>
          <span>
            {engineState?.running ? "Simulation running" : "Simulation paused"}
          </span>
        </div>
      )}
      <iframe
        key={generation}
        ref={frame}
        inert={busy || cloud.busy}
        className={styles.frame}
        data-focused={canvasFocus}
        title="designElectronics circuit editor"
        src="/app/vendor/design-electronics/index.html"
        srcDoc={ENGINE_DOCUMENT_HTML}
        sandbox="allow-scripts allow-downloads"
        onLoad={connect}
      />
      <div className={styles.toolbar} aria-label="Circuit files">
        <div className={styles.group}>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={() => file.current?.click()}
          >
            Open .dez
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={download}
          >
            Download .dez
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={() => void downloadSketches()}
          >
            Download .ino
          </Button>
          <input
            ref={file}
            type="file"
            accept=".dez,application/json"
            hidden
            onChange={(event) => {
              void open(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <details className={styles.projects}>
        <summary>Private projects</summary>
        <div className={styles.toolbar}>
          <Button
            disabled={!ready || busy || cloud.busy || !cloud.available}
            onClick={() => cloud.save()}
          >
            Save snapshot
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy || !cloud.available}
            onClick={() => cloud.save(true)}
          >
            Save separate copy
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || cloud.busy}
            onClick={cloud.refresh}
          >
            Refresh private projects
          </Button>
        </div>
        {cloud.notice && <p role="status">{cloud.notice}</p>}
        {cloud.error && (
          <p role="alert" className={styles.error}>
            {cloud.error}
          </p>
        )}
        {cloud.available && cloud.projects.length === 0 && (
          <p>
            No private electronics projects yet. Save a snapshot to keep this
            circuit with your account.
          </p>
        )}
        <ul>
          {cloud.projects.map((item) => (
            <li key={item.id}>
              <span>
                {item.name} · revision {item.revision}
              </span>
              <Button
                variant="outline"
                disabled={!ready || busy || cloud.busy}
                onClick={() => cloud.open(item.id)}
              >
                Open {item.name}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || cloud.busy}
                onClick={() => cloud.remove(item)}
              >
                Delete {item.name}
              </Button>
            </li>
          ))}
        </ul>
        {cloud.hasMore && (
          <Button variant="outline" disabled={cloud.busy} onClick={cloud.older}>
            Load older projects
          </Button>
        )}
        {cloud.legacy.length > 0 && (
          <>
            <h2>Copy from your original Playground</h2>
            <p>
              Original saves and learning progress stay unchanged. The new
              simulator can behave differently.
            </p>
            <ul>
              {cloud.legacy.map((item) => (
                <li key={item.id}>
                  <span>{item.name}</span>
                  <Button
                    variant="outline"
                    disabled={!ready || busy || cloud.busy}
                    onClick={() => cloud.importLegacy(item)}
                  >
                    Create copy of {item.name}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        {cloud.legacyMore && (
          <Button
            variant="outline"
            disabled={cloud.busy}
            onClick={cloud.olderLegacy}
          >
            Load older legacy projects
          </Button>
        )}
      </details>
      <p className={styles.notice}>
        {cloud.available
          ? "Save a private snapshot or download .dez before leaving."
          : "Download your circuit before leaving. Private saving requires the separately approved storage rollout."}{" "}
        AI drafts require a separately enabled planner. Simulation uses an
        Arduino subset interpreter; it does not verify real hardware.
      </p>
      <footer className={styles.footer}>
        <p>
          Use the native editor menus for components, wiring, Arduino code and
          exports. Its technical canvas retains the upstream rendering.{" "}
          <a
            href="/app/vendor/design-electronics/THIRD-PARTY-NOTICES.txt"
            target="_blank"
            rel="noreferrer"
          >
            Open-source notices
          </a>
        </p>
        <Button
          variant="outline"
          disabled={cloud.busy}
          onClick={() => {
            if (
              window.confirm(
                "Reload the engine? Unsaved local changes will be lost.",
              )
            ) {
              bridge.current?.close();
              cloud.detach();
              setReady(false);
              setError("");
              setMessage("Reloading the local engine…");
              setGeneration((value) => value + 1);
            }
          }}
        >
          Reload engine
        </Button>
      </footer>
    </section>
  );
}
