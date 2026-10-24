"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import Link from "next/link";

import Image from "next/image";

import {
  Cable,
  Check,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  Hand,
  HelpCircle,
  Lightbulb,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "./ui/button";

import { useApp } from "./app-provider";

import { PlaygroundHelp } from "./playground-help";

import { useProjectAccount } from "@/lib/playground/use-project-account";

import {
  catalog,
  connect,
  emptyProject,
  newPart,
  removePart,
  snap,
  terminalKey,
  terminalPoint,
  type Kind,
  type Part,
  type Project,
  type Terminal,
} from "@/lib/playground/model";

import { commit, redo, undo, type History } from "@/lib/playground/history";

import {
  missions,
  startMission,
  missionProgress,
  observeCheck,
} from "@/lib/playground/missions";

import { evaluate } from "@/lib/playground/engine";

type Tool = "select" | "pan";

const kinds = Object.keys(catalog) as Kind[];

export function Playground() {
  const app = useApp();
  return <Workbench key={app.user?.id || "guest"} />;
}

function Workbench() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const app = useApp();

  const [history, setHistory] = useState<History>({
    past: [],
    present: emptyProject(),
    future: [],
  });

  const p = history.present;

  const account = useProjectAccount(p, (value) => {
    setHistory({ past: [], present: value, future: [] });
    setChecked(false);
    setSelected("");
    setStart(null);
    setPending(null);
    setNotice(
      "Saved project reopened. Check the circuit to see its current behavior.",
    );
  });

  const [target, setTarget] = useState("");

  const [showMissions, setShowMissions] = useState(false);

  const [selected, setSelected] = useState(""),
    [pending, setPending] = useState<Kind | null>(null),
    [start, setStart] = useState<Terminal | null>(null),
    [tool, setTool] = useState<Tool>("select");

  const [zoom, setZoom] = useState(0.8),
    [pan, setPan] = useState({ x: 24, y: 24 }),
    [notice, setNotice] = useState(
      "Choose a component, then tap the workbench to place it.",
    ),
    [checked, setChecked] = useState(false);

  const board = useRef<HTMLDivElement>(null),
    world = useRef<HTMLDivElement>(null),
    viewport = useRef({ zoom, pan });
  viewport.current = { zoom, pan };

  const result = evaluate(p),
    part = p.parts.find((c) => c.id === selected),
    wire = p.wires.find((w) => w.id === selected);

  const update = (value: Project) => {
    const signature = (v: Project) =>
      JSON.stringify({
        parts: v.parts.map(({ id, kind, value }) => ({ id, kind, value })),
        wires: v.wires,
      });
    if (signature(value) !== signature(p)) value = { ...value, switchSeen: [] };
    setHistory((h) => commit(h, value));
    setChecked(false);
  };

  const remove = () => {
    if (part) update(removePart(p, part.id));
    else if (wire)
      update({ ...p, wires: p.wires.filter((w) => w.id !== wire.id) });
    setSelected("");
    setStart(null);
  };

  const escape = () => {
    setPending(null);
    setStart(null);
    setSelected("");
  };

  function place(kind: Kind, x: number, y: number) {
    if (p.parts.length >= 40) {
      setNotice("This workbench supports up to 40 components.");
      return;
    }
    const c = newPart(kind, crypto.randomUUID(), snap(x, 840), snap(y, 480));
    update({ ...p, parts: [...p.parts, c] });
    setSelected(c.id);
    setPending(null);
    setNotice(
      `${catalog[kind].label} placed. Connect the labeled terminal buttons.`,
    );
  }

  function point(clientX: number, clientY: number) {
    const r = board.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - pan.x) / zoom,
      y: (clientY - r.top - pan.y) / zoom,
    };
  }

  function chooseTerminal(t: Terminal) {
    setPending(null);
    if (!start) {
      setStart(t);
      setNotice(
        "Choose another terminal to complete the wire. Escape cancels.",
      );
      return;
    }
    try {
      update(connect(p, start, t, crypto.randomUUID()));
      setNotice("Electrical connection added.");
    } catch (e) {
      setNotice((e as Error).message);
    }
    setStart(null);
  }

  function patch(values: Partial<Part>) {
    if (part)
      update({
        ...p,
        parts: p.parts.map((c) => (c.id === part.id ? { ...c, ...values } : c)),
      });
  }

  function dragPart(e: ReactPointerEvent<HTMLButtonElement>, c: Part) {
    if (e.button !== 0 || tool === "pan") return;
    e.stopPropagation();
    setSelected(c.id);
    setPending(null);

    const handle = e.currentTarget,
      container = handle.parentElement!,
      origin = { x: e.clientX, y: e.clientY };
    let last = { x: c.x, y: c.y };

    handle.setPointerCapture(e.pointerId);

    const render = (x: number, y: number) => {
      container.style.transform = `translate(${x}px,${y}px)`;
      const moved = { ...c, x, y };
      for (const w of p.wires) {
        if (w.from.part !== c.id && w.to.part !== c.id) continue;
        const a = p.parts.find((v) => v.id === w.from.part)!,
          b = p.parts.find((v) => v.id === w.to.part)!;
        const from = terminalPoint(a.id === c.id ? moved : a, w.from.pin),
          to = terminalPoint(b.id === c.id ? moved : b, w.to.pin);
        world.current
          ?.querySelectorAll(`[data-wire="${w.id}"]`)
          .forEach((el) => el.setAttribute("d", path(from, to)));
      }
    };

    const move = (event: PointerEvent) => {
      last = {
        x: snap(c.x + (event.clientX - origin.x) / zoom, 840),
        y: snap(c.y + (event.clientY - origin.y) / zoom, 480),
      };
      render(last.x, last.y);
    };

    const finish = (event: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", cancel);
      if (handle.hasPointerCapture(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      if (last.x !== c.x || last.y !== c.y)
        update({
          ...p,
          parts: p.parts.map((v) => (v.id === c.id ? { ...v, ...last } : v)),
        });
    };

    const cancel = () => {
      render(c.x, c.y);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", cancel);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", cancel);
  }

  function panBoard(e: ReactPointerEvent<HTMLDivElement>) {
    if (tool !== "pan" || e.button !== 0) return;
    const el = e.currentTarget,
      origin = { x: e.clientX, y: e.clientY },
      before = pan;
    let next = pan;
    el.setPointerCapture(e.pointerId);
    const move = (v: PointerEvent) => {
      next = {
        x: Math.max(-1000, Math.min(1000, before.x + v.clientX - origin.x)),
        y: Math.max(-640, Math.min(640, before.y + v.clientY - origin.y)),
      };
      if (world.current)
        world.current.style.transform = `translate(${next.x}px,${next.y}px) scale(${zoom})`;
    };
    const finish = () => {
      setPan(next);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", finish);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  }

  function fit() {
    const width = board.current?.clientWidth || 700;
    const z = Math.min(1, (width - 72) / 1000);
    setZoom(Math.max(0.25, z));
    setPan({ x: 24, y: 24 });
  }

  useEffect(() => {
    const resize = () => {
      const width = board.current?.clientWidth || 700;
      setZoom(width < 500 ? 0.65 : Math.min(1, (width - 72) / 1000));
      setPan({ x: 36, y: 36 });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (board.current) observer.observe(board.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (e.key === "Escape") escape();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
        setChecked(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        setHistory(redo);
        setChecked(false);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) {
          e.preventDefault();
          remove();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <section
      className="playground"
      data-ready={ready}
      inert={!ready}
      aria-busy={!ready}
    >
      <div className="pg-heading">
        <div>
          <h1>
            Playground
            <span className="pg-title-mark">
              <CircuitBoard size={23} aria-hidden="true" />
            </span>
          </h1>
          <p>Build a little. Learn a lot.</p>
        </div>
        <div className="pg-actions">
          <Button
            variant="secondary"
            onClick={() => {
              update(emptyProject());
              escape();
              setNotice(
                "Workbench cleared. Undo restores your previous circuit.",
              );
            }}
          >
            <RotateCcw aria-hidden="true" />
            Clear
          </Button>
          <Button
            onClick={() => {
              const observed = observeCheck(p);
              setHistory((h) => commit(h, observed));
              setChecked(true);
              setNotice(result.message);
            }}
          >
            <Play aria-hidden="true" />
            Check circuit
          </Button>
        </div>
      </div>

      <div className="pg-projectbar">
        <label>
          Project name
          <input
            name="projectName"
            autoComplete="off"
            maxLength={80}
            value={p.name}
            onChange={(e) => update({ ...p, name: e.target.value })}
          />
        </label>
        <div className="pg-mode" aria-label="Build mode">
          <button
            aria-pressed={!p.mission}
            onClick={() => update({ ...p, mission: "" })}
          >
            Free Build
          </button>
          <button
            aria-pressed={!!p.mission}
            onClick={() => setShowMissions((v) => !v)}
          >
            Missions
          </button>
        </div>
        <Button
          variant="outline"
          disabled={!app.user || account.busy}
          onClick={() => account.save()}
        >
          <Save aria-hidden="true" />
          {account.busy ? "Saving…" : "Save project"}
        </Button>
        {account.saved && (
          <Button
            variant="ghost"
            disabled={!app.user || account.busy}
            onClick={() => account.save(true)}
          >
            Save copy
          </Button>
        )}
      </div>

      <div className="pg-save-status" role="status">
        {app.user ? (
          account.dirty ? (
            "Unsaved changes"
          ) : account.saved ? (
            "Saved to your private account"
          ) : (
            "Ready to save to your account"
          )
        ) : (
          <>
            <Link href="/settings">Sign in</Link> to save projects. You can
            experiment without an account.
          </>
        )}
      </div>

      {account.error && (
        <div className="pg-save-error" role="alert">
          <p>{account.error}</p>
          <Button
            variant="outline"
            disabled={account.busy || !app.user}
            onClick={() => account.save(true)}
          >
            Save separate copy
          </Button>
          <Button variant="ghost" onClick={() => account.refresh()}>
            Refresh projects
          </Button>
        </div>
      )}

      {app.user && (
        <details className="pg-saved">
          <summary>
            Saved projects ({account.projects.length}
            {account.hasMore ? "+" : ""})
          </summary>
          <Button
            variant="ghost"
            disabled={account.busy}
            onClick={account.refresh}
          >
            Refresh projects
          </Button>
          {!account.projects.length ? (
            <p>No saved projects yet. Save your first circuit above.</p>
          ) : (
            account.projects.map((item) => (
              <div key={item.id}>
                <button
                  disabled={account.busy}
                  onClick={() => account.open(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.updated_at))}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete saved project ${item.name}`}
                  disabled={account.busy}
                  onClick={() => account.remove(item)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          )}
          {account.hasMore && (
            <Button variant="secondary" onClick={account.loadMore}>
              Load older projects
            </Button>
          )}
        </details>
      )}

      {showMissions && (
        <div className="pg-mission-picker">
          <div className="pg-panel-title">
            <h2>Learn by building</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close mission picker"
              onClick={() => setShowMissions(false)}
            >
              <X />
            </Button>
          </div>
          <p>Three small challenges. A clearer understanding of circuits.</p>
          <div>
            {missions.map((m, i) => (
              <button
                key={m.id}
                onClick={() => {
                  update(startMission(m.id, p.completed));
                  setShowMissions(false);
                  escape();
                  setNotice(m.objective);
                }}
              >
                <span>
                  {p.completed.includes(m.id) ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
                <strong>{m.title}</strong>
                <p>{m.objective}</p>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {p.mission && (
        <MissionPanel
          project={p}
          checked={checked}
          onHint={() => update({ ...p, hints: Math.min(3, p.hints + 1) })}
        />
      )}

      <div
        className={`pg-feedback ${checked ? `pg-result-${result.status}` : ""}`}
        role="status"
        aria-live="polite"
      >
        <span>
          {checked ? (
            result.status === "lit" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <HelpCircle aria-hidden="true" />
            )
          ) : (
            <Lightbulb aria-hidden="true" />
          )}
        </span>
        <div>
          <strong>
            {checked
              ? result.status === "lit"
                ? "Expected LED behavior"
                : result.status === "unsafe"
                  ? "Potential damage warning"
                  : result.status === "unsupported"
                    ? "Outside supported rules"
                    : "Circuit feedback"
              : "Your workbench, your pace"}
          </strong>
          <p>{checked ? result.message : notice}</p>
        </div>
        {(start || pending) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel placement or wire"
            onClick={escape}
          >
            <X />
          </Button>
        )}
      </div>
      <div className="pg-layout">
        <aside className="pg-tray">
          <div className="pg-panel-title">
            <h2>Components</h2>
            <span>4 essentials</span>
          </div>
          <p className="pg-muted">
            Drag onto the board, or choose and tap to place.
          </p>
          <div className="pg-parts">
            {kinds.map((kind) => (
              <button
                key={kind}
                draggable
                className={`pg-tray-item ${pending === kind ? "active" : ""}`}
                aria-pressed={pending === kind}
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/ohmi-component", kind)
                }
                onClick={() => {
                  setPending(kind);
                  setTool("select");
                  setNotice(
                    `Tap the workbench to place ${catalog[kind].label.toLowerCase()}. Or press Enter on the workbench.`,
                  );
                }}
              >
                <Image
                  src={`/app/library/${catalog[kind].image}.webp`}
                  alt=""
                  width={84}
                  height={72}
                />
                <span>{catalog[kind].label}</span>
                <Plus size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="pg-scope-note">
            <CircuitBoard size={20} aria-hidden="true" />
            <strong>Direct terminal wiring</strong>
            <p>
              Breadboard electrical connectivity is not supported yet. Every
              wire here joins two labeled terminals.
            </p>
            <Link href="/library">
              Explore the Library
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <div className="pg-center">
          <div className="pg-toolbar">
            <div>
              <Button
                variant={tool === "select" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Select and place tool"
                aria-pressed={tool === "select"}
                onClick={() => setTool("select")}
              >
                <MousePointer2 />
              </Button>
              <Button
                variant={tool === "pan" ? "secondary" : "ghost"}
                size="icon"
                aria-label="Pan workbench"
                aria-pressed={tool === "pan"}
                onClick={() => {
                  setTool("pan");
                  setPending(null);
                  setStart(null);
                }}
              >
                <Hand />
              </Button>
              <span className="pg-divider" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Undo"
                disabled={!history.past.length}
                onClick={() => {
                  setHistory(undo);
                  setChecked(false);
                }}
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Redo"
                disabled={!history.future.length}
                onClick={() => {
                  setHistory(redo);
                  setChecked(false);
                }}
              >
                <Redo2 />
              </Button>
            </div>
            <span className="pg-count">
              {p.parts.length} parts / {p.wires.length} wires
            </span>
          </div>

          <div className="pg-focus-control">
            <label>
              View component
              <select
                aria-label="Focus component"
                value={part?.id || ""}
                onChange={(e) => {
                  const c = p.parts.find((c) => c.id === e.target.value);
                  if (!c) return;
                  const z = 0.8;
                  setSelected(c.id);
                  setZoom(z);
                  setPan({
                    x: (board.current?.clientWidth || 350) / 2 - (c.x + 72) * z,
                    y: 80 - c.y * z,
                  });
                }}
              >
                <option value="">Choose a component to center</option>
                {p.parts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {catalog[c.kind].label} {c.id.slice(0, 4)}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {p.parts.length} parts / {p.wires.length} wires
            </span>
          </div>
          <div
            ref={board}
            className={`pg-viewport ${tool === "pan" ? "panning" : ""} ${pending ? "placing" : ""}`}
            role="region"
            aria-label="Circuit workbench"
            tabIndex={0}
            onPointerDown={panBoard}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button,path")) return;
              if (pending && tool === "select") {
                const at = point(e.clientX, e.clientY);
                place(pending, at.x - 72, at.y - 72);
              } else if (tool === "select") setSelected("");
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" && pending) {
                e.preventDefault();
                place(
                  pending,
                  48 + (p.parts.length % 4) * 192,
                  48 + Math.floor(p.parts.length / 4) * 192,
                );
              }
              if (e.key.startsWith("Arrow")) {
                e.preventDefault();
                setPan((v) => ({
                  x:
                    v.x +
                    (e.key === "ArrowRight"
                      ? -48
                      : e.key === "ArrowLeft"
                        ? 48
                        : 0),
                  y:
                    v.y +
                    (e.key === "ArrowDown"
                      ? -48
                      : e.key === "ArrowUp"
                        ? 48
                        : 0),
                }));
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const kind = e.dataTransfer.getData(
                "application/ohmi-component",
              ) as Kind;
              if (!kinds.includes(kind)) return;
              const at = point(e.clientX, e.clientY);
              place(kind, at.x - 72, at.y - 72);
            }}
          >
            <div
              ref={world}
              className="pg-world"
              style={{
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className="pg-wires"
                viewBox="0 0 1000 640"
                aria-hidden="true"
              >
                {p.wires.map((w) => {
                  const a = p.parts.find((c) => c.id === w.from.part)!,
                    b = p.parts.find((c) => c.id === w.to.part)!;
                  return (
                    <g key={w.id}>
                      <path
                        data-wire={w.id}
                        d={path(
                          terminalPoint(a, w.from.pin),
                          terminalPoint(b, w.to.pin),
                        )}
                        className={`pg-wire ${selected === w.id ? "selected" : ""}`}
                      />
                      <path
                        data-wire={w.id}
                        d={path(
                          terminalPoint(a, w.from.pin),
                          terminalPoint(b, w.to.pin),
                        )}
                        className="pg-wire-hit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(w.id);
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {!p.parts.length && (
                <div className="pg-empty">
                  <div className="pg-empty-art">
                    <Image
                      src="/app/library/led.webp"
                      alt=""
                      width={140}
                      height={140}
                    />
                    <Image
                      src="/app/library/resistor.webp"
                      alt=""
                      width={120}
                      height={120}
                    />
                  </div>
                  <h2>Your next bright idea starts here.</h2>
                  <p>
                    Add a supply, resistor and LED.
                    <br />
                    Then connect their terminals into a loop.
                  </p>
                  <span>
                    <Cable size={16} aria-hidden="true" />
                    Real connections. Room to experiment.
                  </span>
                </div>
              )}

              {p.parts.map((c) => (
                <div
                  key={c.id}
                  className={`pg-component ${selected === c.id ? "selected" : ""} ${checked && result.status === "lit" && c.kind === "led" ? "pg-lit" : ""}`}
                  data-part={c.id}
                  style={{ transform: `translate(${c.x}px,${c.y}px)` }}
                >
                  <button
                    className="pg-part-handle"
                    aria-label={`Select ${catalog[c.kind].label} ${c.id.slice(0, 4)}`}
                    onClick={() => setSelected(c.id)}
                    onPointerDown={(e) => dragPart(e, c)}
                    onKeyDown={(e) => {
                      if (e.key.startsWith("Arrow")) {
                        e.preventDefault();
                        e.stopPropagation();
                        const dx =
                            e.key === "ArrowRight"
                              ? 24
                              : e.key === "ArrowLeft"
                                ? -24
                                : 0,
                          dy =
                            e.key === "ArrowDown"
                              ? 24
                              : e.key === "ArrowUp"
                                ? -24
                                : 0;
                        update({
                          ...p,
                          parts: p.parts.map((v) =>
                            v.id === c.id
                              ? {
                                  ...v,
                                  x: snap(v.x + dx, 840),
                                  y: snap(v.y + dy, 480),
                                }
                              : v,
                          ),
                        });
                      }
                    }}
                  >
                    <Image
                      src={`/app/library/${catalog[c.kind].image}.webp`}
                      alt=""
                      width={92}
                      height={78}
                      draggable={false}
                    />
                    <strong>{catalog[c.kind].label}</strong>
                    <small>
                      {c.kind === "battery"
                        ? `${c.value} V`
                        : c.kind === "resistor"
                          ? `${c.value} Ω`
                          : c.kind === "switch"
                            ? c.closed
                              ? "Closed"
                              : "Open"
                            : "2 V / 20 mA"}
                    </small>
                    {checked && result.status === "lit" && c.kind === "led" && (
                      <span className="pg-lit-label">LED on</span>
                    )}
                  </button>

                  {zoom >= 0.5 &&
                    catalog[c.kind].pins.map((pin, i) => (
                      <button
                        key={pin}
                        style={{ transform: `scale(${1 / zoom})` }}
                        className={`pg-terminal terminal-${i} ${start && terminalKey(start) === terminalKey({ part: c.id, pin }) ? "active" : ""}`}
                        aria-label={`${catalog[c.kind].label} ${c.id.slice(0, 4)} terminal ${catalog[c.kind].names[i]}`}
                        aria-pressed={
                          !!start &&
                          terminalKey(start) ===
                            terminalKey({ part: c.id, pin })
                        }
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          chooseTerminal({ part: c.id, pin });
                        }}
                      >
                        <span>{catalog[c.kind].names[i]}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="pg-canvas-footer">
            <span>
              {zoom < 0.5
                ? "Overview. Zoom in to connect terminals."
                : start
                  ? "Choose the second terminal"
                  : pending
                    ? `Place ${catalog[pending].label.toLowerCase()}`
                    : tool === "pan"
                      ? "Drag to pan. Scroll the page outside the board."
                      : "24 px snap / tap terminals to wire"}
            </span>
            <div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom out"
                onClick={() => setZoom((v) => Math.max(0.25, v - 0.15))}
              >
                <ZoomOut />
              </Button>
              <button
                className="pg-fit"
                onClick={fit}
                aria-label={`Fit workbench (${Math.round(zoom * 100)}%)`}
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom in"
                onClick={() => setZoom((v) => Math.min(1.75, v + 0.15))}
              >
                <ZoomIn />
              </Button>
            </div>
          </div>
        </div>

        <aside className="pg-inspector">
          <div className="pg-panel-title">
            <h2>{part ? "Component" : wire ? "Connection" : "Inspector"}</h2>
            {(part || wire) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Deselect"
                onClick={escape}
              >
                <X />
              </Button>
            )}
          </div>

          {part ? (
            <>
              <Image
                className="pg-inspector-art"
                src={`/app/library/${catalog[part.kind].image}.webp`}
                alt=""
                width={140}
                height={100}
              />
              <h3>{catalog[part.kind].label}</h3>
              <p>{catalog[part.kind].detail}</p>
              {(part.kind === "battery" || part.kind === "resistor") && (
                <label>
                  {part.kind === "battery" ? "Voltage (V)" : "Resistance (Ω)"}
                  <input
                    type="number"
                    name="componentValue"
                    step={part.kind === "battery" ? 0.5 : 1}
                    min={part.kind === "battery" ? 1.5 : 1}
                    max={part.kind === "battery" ? 12 : 1000000}
                    value={part.value}
                    onChange={(e) => patch({ value: Number(e.target.value) })}
                  />
                </label>
              )}
              {part.kind === "switch" && (
                <Button
                  variant="secondary"
                  aria-pressed={part.closed}
                  onClick={() => patch({ closed: !part.closed })}
                >
                  {part.closed ? "Open switch" : "Close switch"}
                </Button>
              )}
              <div className="pg-position">
                <label>
                  X
                  <input
                    aria-label="Component X position"
                    type="number"
                    min={0}
                    max={840}
                    step={24}
                    value={part.x}
                    onChange={(e) =>
                      patch({ x: snap(Number(e.target.value), 840) })
                    }
                  />
                </label>
                <label>
                  Y
                  <input
                    aria-label="Component Y position"
                    type="number"
                    min={0}
                    max={480}
                    step={24}
                    value={part.y}
                    onChange={(e) =>
                      patch({ y: snap(Number(e.target.value), 480) })
                    }
                  />
                </label>
              </div>
              <Button variant="ghost" onClick={remove}>
                <Trash2 aria-hidden="true" />
                Delete component
              </Button>
            </>
          ) : wire ? (
            <>
              <h3>Terminal connection</h3>
              <p>
                {describe(p, wire.from)} to {describe(p, wire.to)}.
              </p>
              <Button variant="secondary" onClick={remove}>
                <Trash2 aria-hidden="true" />
                Delete wire
              </Button>
            </>
          ) : (
            <>
              <div className="pg-inspector-idle">
                <MousePointer2 size={28} aria-hidden="true" />
              </div>
              <h3>A closer look</h3>
              <p>
                Select a component to change its properties. Use arrow keys to
                move a selected component, or edit its X and Y position.
              </p>
            </>
          )}

          <details className="pg-connect-form">
            <summary>Connect with controls</summary>
            <label>
              From
              <select
                aria-label="Wire from terminal"
                value={start ? terminalKey(start) : ""}
                onChange={(e) => {
                  const [part, pin] = e.target.value.split(":");
                  setStart(part ? { part, pin } : null);
                }}
              >
                <option value="">Choose a terminal</option>
                {p.parts.flatMap((c) =>
                  catalog[c.kind].pins.map((pin, i) => (
                    <option
                      key={c.id + pin}
                      value={terminalKey({ part: c.id, pin })}
                    >
                      {catalog[c.kind].label} {c.id.slice(0, 4)}{" "}
                      {catalog[c.kind].names[i]}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label>
              To
              <select
                aria-label="Wire to terminal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose a terminal</option>
                {p.parts.flatMap((c) =>
                  catalog[c.kind].pins.map((pin, i) => (
                    <option
                      key={c.id + pin}
                      value={terminalKey({ part: c.id, pin })}
                    >
                      {catalog[c.kind].label} {c.id.slice(0, 4)}{" "}
                      {catalog[c.kind].names[i]}
                    </option>
                  )),
                )}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={!start || !target}
              onClick={() => {
                const [part, pin] = target.split(":");
                chooseTerminal({ part, pin });
                setTarget("");
              }}
            >
              <Cable aria-hidden="true" />
              Connect wire
            </Button>
          </details>

          <details className="pg-wire-list">
            <summary>Connections ({p.wires.length})</summary>
            {p.wires.length ? (
              p.wires.map((w, i) => (
                <button
                  key={w.id}
                  aria-pressed={selected === w.id}
                  onClick={() => setSelected(w.id)}
                >
                  {i + 1}. {describe(p, w.from)} to {describe(p, w.to)}
                </button>
              ))
            ) : (
              <p>No wires yet. Tap two terminal buttons to connect.</p>
            )}
          </details>

          <div className="pg-helper">
            <Image src="/app/mascot.png" alt="OHMI" width={42} height={50} />
            <div>
              <h3>Small steps. Bright ideas.</h3>
              <p>
                Build one loop: supply +, resistor, LED anode, LED cathode,
                supply −.
              </p>
            </div>
          </div>

          <PlaygroundHelp project={p} />
        </aside>
      </div>

      <details className="pg-limits">
        <summary>What can this Playground evaluate?</summary>
        <p>{result.scope}</p>
        <p>
          Red LED: fixed 2 V forward drop; 1–20 mA expected-light range.
          Resistors: positive resistance up to 1 MΩ, 0.25 W each. Source: 1.5–12
          V DC. Wires are ideal; resistance, heat, leakage, battery chemistry
          and brightness are not simulated. Never use these estimates as
          permission to power real hardware.
        </p>
      </details>
    </section>
  );
}

function path(a: { x: number; y: number }, b: { x: number; y: number }) {
  const bend = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${bend} ${a.y}, ${bend} ${b.y}, ${b.x} ${b.y}`;
}

function describe(p: Project, t: Terminal) {
  const c = p.parts.find((v) => v.id === t.part)!;
  return `${catalog[c.kind].label} ${c.id.slice(0, 4)} ${t.pin.toUpperCase()}`;
}

function MissionPanel({
  project: p,
  checked,
  onHint,
}: {
  project: Project;
  checked: boolean;
  onHint: () => void;
}) {
  const m = missions.find((m) => m.id === p.mission);
  if (!m) return null;
  const progress = missionProgress(p),
    complete = checked && progress.complete;
  return (
    <section className="pg-mission" aria-label="Current mission">
      <div>
        <span className="pg-mission-icon">
          {complete ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <CircuitBoard aria-hidden="true" />
          )}
        </span>
        <div>
          <h2>{m.title}</h2>
          <p>{m.objective}</p>
        </div>
        <Button variant="secondary" onClick={onHint} disabled={p.hints >= 3}>
          <Lightbulb aria-hidden="true" />
          {p.hints >= 3 ? "All hints shown" : "Get a hint"}
        </Button>
      </div>
      <ol>
        {progress.steps.map((step) => (
          <li key={step.label} className={step.done ? "done" : ""}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {step.label}
          </li>
        ))}
      </ol>
      {p.hints > 0 && (
        <div className="pg-hints">
          {m.hints.slice(0, p.hints).map((hint, i) => (
            <p key={hint}>
              <strong>Hint {i + 1}.</strong> {hint}
            </p>
          ))}
        </div>
      )}
      {complete && (
        <div className="pg-mission-success" role="status">
          <strong>Mission complete. Nicely connected.</strong>
          <p>{m.explanation}</p>
        </div>
      )}
    </section>
  );
}
