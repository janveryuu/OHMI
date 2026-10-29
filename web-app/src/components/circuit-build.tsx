"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import styles from "./circuit-build.module.css";
import {
  validateCircuitBuildResult,
  type CircuitBuildResult,
} from "@/lib/playground/circuit-spec";

export function CircuitBuild({ conversationId }: { conversationId: string }) {
  const app = useApp();
  return app.user ? (
    <Builder
      key={app.user.id}
      accountId={app.user.id}
      conversationId={conversationId}
    />
  ) : null;
}
function Builder({
  accountId,
  conversationId,
}: {
  accountId: string;
  conversationId: string;
}) {
  const app = useApp(),
    [enabled, setEnabled] = useState(false),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [result, setResult] = useState<CircuitBuildResult | null>(null),
    [requestId, setRequestId] = useState(""),
    [unresolved, setUnresolved] = useState(false);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    waiting = useRef(false);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    try {
      const saved = sessionStorage.getItem("ohmi-build-request:" + accountId);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) {
        setRequestId(saved);
        setUnresolved(true);
        setNotice(
          "An earlier request may still be processing. Check its status first.",
        );
      }
    } catch {}
    fetch("/app/api/playground/build/", {
      headers: { "x-ohmi-account": accountId },
      cache: "no-store",
      signal: abort.signal,
    })
      .then((r) => r.json())
      .then((value) => {
        if (alive.current) setEnabled(value.enabled === true);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      abort.abort();
      controller.current?.abort();
    };
  }, [accountId]);
  async function run(recover = false) {
    if (waiting.current || (!recover && unresolved)) return;
    waiting.current = true;
    setBusy(true);
    setNotice("");
    const abort = new AbortController();
    controller.current = abort;
    const id = recover ? requestId : crypto.randomUUID();
    setRequestId(id);
    setResult(null);
    setUnresolved(true);
    try {
      sessionStorage.setItem("ohmi-build-request:" + accountId, id);
    } catch {}
    const resolved = () => {
      setUnresolved(false);
      try {
        sessionStorage.removeItem("ohmi-build-request:" + accountId);
      } catch {}
    };
    try {
      const conversation = recover
        ? ""
        : conversationId || (await app.newConversation("Circuit build"));
      if (!alive.current || abort.signal.aborted) return;
      const response = await fetch(
        "/app/api/playground/build/" + (recover ? "?id=" + id : ""),
        {
          method: recover ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ohmi-account": accountId,
          },
          cache: "no-store",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(32000)]),
          ...(recover
            ? {}
            : {
                body: JSON.stringify({
                  requestId: id,
                  conversationId: conversation,
                  language: app.language.toLowerCase(),
                  message: prompt,
                }),
              }),
        },
      );
      const data = await response.json();
      if (!alive.current || abort.signal.aborted) return;
      if (!response.ok) {
        if (recover && response.status === 404) resolved();
        throw new Error(
          data.error ||
            "Build unavailable. Check this request before trying again.",
        );
      }
      if (data.accountId !== accountId || data.requestId !== id)
        throw new Error("Account or request changed. Reload your workspace.");
      if (data.result) {
        setResult(validateCircuitBuildResult(data.result));
        resolved();
        if (conversation) await app.refreshConversation(conversation);
      } else {
        if (data.status !== "pending") resolved();
        setNotice(
          data.status === "pending"
            ? "Still processing. Check status again."
            : "Request " +
                data.status +
                ". A new build requires a new explicit action.",
        );
      }
    } catch (error) {
      if (alive.current)
        setNotice(
          abort.signal.aborted
            ? "Stopped waiting. The server may finish; check status before starting another build."
            : error instanceof Error
              ? error.message
              : "Build unavailable. Check status.",
        );
    } finally {
      waiting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <details className={styles.builder}>
      <summary>Build a circuit with OHMI</summary>
      <p className="small muted">
        Qualified preview: Uno or battery, 1–8 LEDs with dedicated resistors.
        The full manual catalog remains available.
      </p>
      {!enabled && (
        <p className="small muted">
          Automatic building is not enabled on this server. Your chat still
          works.
        </p>
      )}
      <label htmlFor="circuit-build-prompt" className="small">
        Describe your circuit
      </label>
      <textarea
        id="circuit-build-prompt"
        className="input"
        rows={3}
        maxLength={3000}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={busy}
        placeholder="Uno, red LED with 220 ohms, on 500 ms and off 500 ms"
      />
      <div className={styles.actions}>
        <Button
          type="button"
          variant="outline"
          disabled={!enabled || busy || unresolved || !prompt.trim()}
          onClick={() => void run()}
        >
          Build new draft
        </Button>
        {busy && (
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.current?.abort()}
          >
            Stop waiting
          </Button>
        )}
        {requestId && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(true)}
          >
            Check build status
          </Button>
        )}
      </div>
      <p role="status" className="small">
        {busy ? "Planning one bounded circuit request…" : notice}
      </p>
      {result && (
        <div>
          <p>{result.answer}</p>
          {result.circuitSpec.warnings.length > 0 && (
            <ul aria-label="Planner caveats">
              {result.circuitSpec.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          {result.status === "draft" && (
            <Link href={"/playground/electronics/?build=" + requestId}>
              Open new editable draft
            </Link>
          )}
        </div>
      )}
    </details>
  );
}
