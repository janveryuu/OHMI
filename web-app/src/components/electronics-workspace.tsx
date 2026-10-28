"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import { ElectronicsBridge, type EngineRequest } from "@/lib/playground/bridge";
import { useElectronicsProject } from "@/lib/playground/use-electronics-project";
import styles from "./electronics-workspace.module.css";

export function ElectronicsWorkspace() {
  const { user } = useApp();
  return user ? <Editor key={user.id} accountId={user.id} /> : null;
}

function Editor({ accountId }: { accountId: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<ElectronicsBridge | null>(null);
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Loading the local electronics engine…",
  );
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const cloud = useElectronicsProject(bridge, ready, accountId);

  useEffect(() => {
    let leaving = false;
    const location = window.location.href;
    const confirm = () =>
      window.confirm(
        "Leave the electronics workspace? Download your .dez circuit first to keep unsaved changes.",
      );
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving) event.preventDefault();
    };
    const link = (event: MouseEvent) => {
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
      if (!confirm()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else leaving = true;
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
      if (confirm()) {
        leaving = true;
        window.history.back();
      } else guard();
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
      return await bridge.current?.request<T>(request);
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
      <header className={styles.header}>
        <div>
          <h1 id="electronics-title">Electronics workspace</h1>
          <p>Local preview · Your original Playground remains available.</p>
        </div>
        <Link href="/playground/">Back to Playground</Link>
      </header>
      <p className={styles.notice}>
        {cloud.available
          ? "Save a private snapshot or download .dez before leaving."
          : "Download your circuit before leaving. Private saving requires the separately approved storage rollout."}{" "}
        AI building is not connected in this preview. Simulation uses an Arduino
        subset interpreter; it does not verify real hardware.
      </p>
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
      <div className={styles.toolbar} aria-label="Circuit controls">
        <div className={styles.group} aria-label="Circuit view">
          {["Breadboard", "Schematic", "PCB"].map((name, view) => (
            <Button
              key={name}
              variant="outline"
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
      <p role="status" className={styles.status}>
        {message}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <iframe
        key={generation}
        ref={frame}
        inert={busy || cloud.busy}
        className={styles.frame}
        title="designElectronics circuit editor"
        src="/app/vendor/design-electronics/index.html"
        sandbox="allow-scripts allow-downloads"
        onLoad={connect}
      />
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
