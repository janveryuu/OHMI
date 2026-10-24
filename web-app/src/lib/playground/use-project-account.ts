"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { validateProject, type Project } from "./model";
export type SavedProject = {
  id: string;
  name: string;
  revision: number;
  updated_at: string;
};
export function useProjectAccount(
  project: Project,
  onLoad: (p: Project) => void,
) {
  const app = useApp(),
    [projects, setProjects] = useState<SavedProject[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [baseline, setBaseline] = useState(JSON.stringify(project)),
    [hasMore, setHasMore] = useState(false);
  const listSequence = useRef(0);
  const record = useRef({ id: "", revision: 0 }),
    alive = useRef(true),
    requests = useRef(new Set<AbortController>()),
    loadRef = useRef(onLoad);
  loadRef.current = onLoad;
  const dirty = JSON.stringify(project) !== baseline;
  async function request(url: string, options: RequestInit = {}) {
    const c = new AbortController();
    requests.current.add(c);
    try {
      const res = await fetch(url, {
        ...options,
        signal: c.signal,
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Project request failed. Try again.");
      return data;
    } finally {
      requests.current.delete(c);
    }
  }
  async function list(older = false) {
    const sequence = ++listSequence.current;
    const last = older ? projects.at(-1) : null;
    const data = await request(
      "/app/api/playground/" +
        (last
          ? "?before=" + encodeURIComponent(last.updated_at + "|" + last.id)
          : ""),
    );
    if (alive.current && sequence === listSequence.current) {
      setProjects((v) => (older ? [...v, ...data.projects] : data.projects));
      setHasMore(data.hasMore);
    }
  }
  useEffect(() => {
    alive.current = true;
    if (app.user)
      list().catch((e) => {
        if (alive.current) setError(e.message);
      });
    return () => {
      alive.current = false;
      requests.current.forEach((c) => c.abort());
    };
  }, [app.user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a || a.getAttribute("href")?.startsWith("#")) return;
      if (
        !window.confirm(
          "You have unsaved Playground changes. Leave without saving?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  async function save(copy = false) {
    if (!app.user || busy) return;
    setBusy(true);
    setError("");
    try {
      const snapshot = validateProject(project);
      const target = copy
        ? { id: crypto.randomUUID(), revision: 0 }
        : record.current.id
          ? record.current
          : { id: crypto.randomUUID(), revision: 0 };
      if (!copy) record.current = target;
      const data = await request("/app/api/playground/", {
        method: "POST",
        body: JSON.stringify({ ...target, project: snapshot }),
      });
      if (!alive.current) return;
      record.current = { id: data.id, revision: data.revision };
      setBaseline(JSON.stringify(snapshot));
      await list();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function open(id: string) {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          "Replace your unsaved workbench with this saved project?",
        ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const data = await request(
        "/app/api/playground/?id=" + encodeURIComponent(id),
      );
      const snapshot = validateProject(data.project);
      if (!alive.current) return;
      record.current = { id: data.id, revision: data.revision };
      setBaseline(JSON.stringify(snapshot));
      loadRef.current(snapshot);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function remove(item: SavedProject) {
    if (
      busy ||
      !window.confirm(
        `Delete saved project “${item.name}”? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/app/api/playground/?id=${item.id}&revision=${item.revision}`,
        { method: "DELETE" },
      );
      if (!alive.current) return;
      if (record.current.id === item.id) {
        record.current = { id: "", revision: 0 };
        setBaseline("");
      }
      await list();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return {
    projects,
    busy,
    error,
    dirty,
    hasMore,
    save,
    open,
    remove,
    loadMore: () => list(true).catch((e) => setError(e.message)),
    refresh: () => list().catch((e) => setError(e.message)),
    saved: !!record.current.id && record.current.revision > 0,
  };
}
