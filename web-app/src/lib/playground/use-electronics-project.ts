"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ElectronicsBridge, EngineStatus } from "./bridge";
import { accountEpoch } from "../backend/guards.mjs";
type Saved = { id: string; name: string; revision: number; updated_at: string };
type RecordId = { id: string; revision: number; documentId: string };
export function useElectronicsProject(
  bridge: { current: ElectronicsBridge | null },
  ready: boolean,
  accountId: string,
) {
  const [projects, setProjects] = useState<Saved[]>([]),
    [legacy, setLegacy] = useState<Saved[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [available, setAvailable] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [legacyMore, setLegacyMore] = useState(false);
  const epoch = useRef(accountEpoch()),
    controllers = useRef(new Set<AbortController>()),
    locked = useRef(false),
    alive = useRef(false),
    record = useRef<RecordId>({ id: "", revision: 0, documentId: "" });
  const request = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!alive.current)
        throw new DOMException("Account changed", "AbortError");
      const generation = epoch.current.capture(),
        controller = new AbortController();
      controllers.current.add(controller);
      const timer = setTimeout(
        () =>
          controller.abort(
            new DOMException(
              "Private project request timed out. Refresh saves before retrying; keep a .dez backup.",
              "TimeoutError",
            ),
          ),
        20000,
      );
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-OHMI-Account": accountId,
          },
        });
        const result = await response.json();
        if (!epoch.current.current(generation))
          throw new DOMException("Account changed", "AbortError");
        if (!response.ok)
          throw new Error(
            result.error ||
              "Private project request failed. Download .dez to keep your work.",
          );
        return result;
      } finally {
        clearTimeout(timer);
        controllers.current.delete(controller);
      }
    },
    [accountId],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      epoch.current.advance();
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
      record.current = { id: "", revision: 0, documentId: "" };
    };
  }, []);
  const refresh = useCallback(async () => {
    const result = await request("/app/api/playground/projects/");
    if (!Array.isArray(result.projects))
      throw new Error(
        "Private electronics saving is unavailable. Download .dez to keep your work.",
      );
    setProjects(result.projects);
    setHasMore(result.hasMore === true);
    setAvailable(true);
    const old = await request("/app/api/playground/projects/?legacy=1");
    setLegacy(Array.isArray(old.projects) ? old.projects : []);
    setLegacyMore(old.hasMore === true);
  }, [request]);
  const perform = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const generation = epoch.current.capture();
    try {
      await action();
    } catch (cause) {
      if (
        epoch.current.current(generation) &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      )
        setError(
          cause instanceof Error ? cause.message : "Project operation failed.",
        );
    } finally {
      if (epoch.current.current(generation)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    if (ready) void perform(refresh);
  }, [ready, perform, refresh]);
  const detach = () => {
    record.current = { id: "", revision: 0, documentId: "" };
    setNotice("Local circuit. Save a new private copy or download .dez.");
  };
  const save = (copy = false) =>
    perform(async () => {
      const captured = await bridge.current?.request<{
        document: { uid: string };
        documentId: string;
      }>({
        operation: "capture",
      });
      if (!captured?.documentId)
        throw new Error(
          "Reload the electronics engine before saving. Keep a .dez backup first.",
        );
      const { document, documentId } = captured;
      const replaced = Boolean(
        record.current.id && record.current.documentId !== documentId,
      );
      const target =
        copy || !record.current.id || replaced
          ? { id: crypto.randomUUID(), revision: 0, documentId }
          : { ...record.current };
      // Keep the UUID after a lost acknowledgement; do not create duplicate rows on retry.
      if (!copy) record.current = target;
      const result = await request("/app/api/playground/projects/", {
        method: "POST",
        body: JSON.stringify({
          id: target.id,
          revision: target.revision,
          document,
        }),
      });
      record.current = {
        id: result.id,
        revision: result.revision,
        documentId,
      };
      setNotice(
        `${replaced ? "Native document changed; created a separate private project. " : ""}Captured circuit saved as revision ${result.revision}. Later edits need another save.`,
      );
      await refresh();
    });
  const open = (id: string) =>
    perform(async () => {
      if (
        !window.confirm(
          "Replace this local circuit? Download unsaved work first.",
        )
      )
        return;
      const result = await request(
        "/app/api/playground/projects/?id=" + encodeURIComponent(id),
      );
      await bridge.current?.request({
        operation: "open",
        document: result.document,
      });
      const status = await bridge.current?.request<EngineStatus>({
        operation: "status",
      });
      if (!status?.documentId)
        throw new Error(
          "Engine document identity is unavailable. Download .dez before continuing.",
        );
      record.current = {
        id: result.id,
        revision: result.revision,
        documentId: status.documentId,
      };
      setNotice(`Opened ${result.name}, revision ${result.revision}.`);
    });
  const importLegacy = (item: Saved) =>
    perform(async () => {
      if (
        !window.confirm(
          "Create a new editable copy of this legacy project and replace the local circuit? The original save stays unchanged.",
        )
      )
        return;
      const created = await request("/app/api/playground/projects/", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          revision: 0,
          legacyId: item.id,
          legacyRevision: item.revision,
        }),
      });
      const result = await request(
        "/app/api/playground/projects/?id=" + created.id,
      );
      await bridge.current?.request({
        operation: "open",
        document: result.document,
      });
      const status = await bridge.current?.request<EngineStatus>({
        operation: "status",
      });
      if (!status?.documentId)
        throw new Error(
          "Engine document identity is unavailable. Download .dez before continuing.",
        );
      record.current = {
        id: result.id,
        revision: result.revision,
        documentId: status.documentId,
      };
      setNotice(
        "Opened a new converted copy. Original missions and progress remain in its source snapshot; simulation behavior may differ.",
      );
      await refresh();
    });
  const remove = (item: Saved) =>
    perform(async () => {
      if (
        !window.confirm(
          `Delete private save “${item.name}”? Download .dez first if you want a backup.`,
        )
      )
        return;
      await request(
        `/app/api/playground/projects/?id=${item.id}&revision=${item.revision}`,
        { method: "DELETE" },
      );
      if (record.current.id === item.id) detach();
      await refresh();
    });
  const older = () =>
    perform(async () => {
      const last = projects.at(-1);
      if (!last) return;
      const result = await request(
        "/app/api/playground/projects/?before=" +
          encodeURIComponent(last.updated_at + "|" + last.id),
      );
      setProjects((current) => [
        ...current,
        ...result.projects.filter(
          (row: Saved) => !current.some((existing) => existing.id === row.id),
        ),
      ]);
      setHasMore(result.hasMore === true);
    });
  const olderLegacy = () =>
    perform(async () => {
      const last = legacy.at(-1);
      if (!last) return;
      const result = await request(
        "/app/api/playground/projects/?legacy=1&before=" +
          encodeURIComponent(last.updated_at + "|" + last.id),
      );
      setLegacy((current) => [
        ...current,
        ...result.projects.filter(
          (row: Saved) => !current.some((existing) => existing.id === row.id),
        ),
      ]);
      setLegacyMore(result.hasMore === true);
    });
  return {
    projects,
    legacy,
    busy,
    error,
    notice,
    available,
    hasMore,
    legacyMore,
    save,
    open,
    importLegacy,
    remove,
    older,
    olderLegacy,
    refresh: () => perform(refresh),
    detach,
  };
}
