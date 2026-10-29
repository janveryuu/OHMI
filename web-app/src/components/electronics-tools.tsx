"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { ElectronicsBridge } from "@/lib/playground/bridge";
import { electronicsPins } from "@/lib/playground/electronics-document";
import styles from "./electronics-tools.module.css";
type Part = {
  id: number;
  type: string;
  label?: string;
  props: Record<string, string>;
  code?: string;
  views?: Record<string, { at: number[] }>;
};
type Document = {
  parts: Part[];
  wires: {
    id: number;
    view: string;
    from?: { part: number; pin: string };
    to?: { part: number; pin: string };
  }[];
  library?: { type: string; pins: { id: string }[] }[];
};
type Entry = {
  type: string;
  title: string;
  category: string;
  properties: Record<string, string>;
};
type Info = {
  properties: Record<string, string>;
  description: string;
  simulation: string;
  propertyDefinitions: { key: string; label: string; options?: string[] }[];
};

export function ElectronicsTools({
  bridge,
  disabled,
  onBusy,
}: {
  bridge: { current: ElectronicsBridge | null };
  disabled: boolean;
  onBusy: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [catalog, setCatalog] = useState<Entry[]>([]),
    [document, setDocument] = useState<Document>({ parts: [], wires: [] }),
    [search, setSearch] = useState(""),
    [entry, setEntry] = useState(""),
    [selected, setSelected] = useState(""),
    [info, setInfo] = useState<Info | null>(null),
    [properties, setProperties] = useState<Record<string, string>>({}),
    [label, setLabel] = useState(""),
    [code, setCode] = useState(""),
    [dirty, setDirty] = useState(false),
    [view, setView] = useState("breadboard"),
    [x, setX] = useState("0"),
    [y, setY] = useState("0"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [fromPin, setFromPin] = useState(""),
    [toPin, setToPin] = useState("");
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function execute<T>(
    work: (session: ElectronicsBridge) => Promise<T>,
  ): Promise<T | undefined> {
    if (lock.current || !bridge.current) return;
    const session = bridge.current;
    lock.current = true;
    setPending(true);
    onBusy(true);
    setError("");
    try {
      const value = await work(session);
      if (alive.current && bridge.current === session) return value;
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Editor action failed. Your local circuit remains available.",
        );
    } finally {
      lock.current = false;
      if (alive.current) {
        setPending(false);
        onBusy(false);
      }
    }
  }
  const snapshot = (session: ElectronicsBridge) =>
    session.request<Document>({ operation: "snapshot" });
  const tool = (
    session: ElectronicsBridge,
    name: string,
    args: Record<string, unknown>,
  ) => session.request({ operation: "tool", name, arguments: args });
  async function load() {
    const result = await execute(async (session) => ({
      catalog: await session.request<Entry[]>({
        operation: "catalog",
        presets: true,
      }),
      document: await snapshot(session),
    }));
    if (result) {
      setCatalog(result.catalog);
      setDocument(result.document);
      setSelected("");
      setInfo(null);
      setDirty(false);
      setNotice(
        `${result.catalog.length} native catalog entries. Adding a component does not prove it has a simulation model.`,
      );
    }
  }
  const discard = () =>
    !dirty ||
    window.confirm(
      "Discard unapplied inspector changes? Apply them first to keep the sketch and property edits.",
    );
  async function inspect(id: string) {
    if (!discard()) return;
    const part = document.parts.find((part) => String(part.id) === id);
    setSelected(id);
    setInfo(null);
    setDirty(false);
    if (!part) return;
    const result = await execute((session) =>
      session.request<Info>({
        operation: "tool",
        name: "get_part_info",
        arguments: { type: part.type, properties: part.props },
      }),
    );
    if (result) {
      setInfo(result);
      setProperties(result.properties);
      setLabel(part.label || "");
      setCode(part.code || "");
      setX(String(part.views?.[view]?.at[0] || 0));
      setY(String(part.views?.[view]?.at[1] || 0));
    }
  }
  async function mutate(
    name: string,
    args: Record<string, unknown>,
    message: string,
  ) {
    const result = await execute(async (session) => {
      await tool(session, name, args);
      return snapshot(session);
    });
    if (result) {
      setDocument(result);
      setNotice(message + " Save a snapshot or download .dez to keep changes.");
      return true;
    }
    return false;
  }
  const pins = (id: string) => {
    const part = document.parts.find((part) => String(part.id) === id);
    if (!part) return [];
    const embedded = document.library?.find((item) => item.type === part.type);
    const native = electronicsPins(part.type, part.props);
    return [
      ...(native.size
        ? native
        : embedded
          ? new Set(embedded.pins.map((pin) => pin.id))
          : []),
    ];
  };
  const partOptions = document.parts.map((part) => (
    <option key={part.id} value={part.id}>
      {part.label || part.type} · {part.type} · #{part.id}
    </option>
  ));
  const current = document.parts.find((part) => String(part.id) === selected);
  const fieldDisabled = pending || disabled;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && (pending || !discard())) return;
        setOpen(value);
        if (value) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Parts &amp; inspector
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.sheet}>
        <DialogTitle>Circuit tools</DialogTitle>
        <DialogDescription>
          Add, inspect and wire components without dragging. All changes use the
          native editor and its undo history.
        </DialogDescription>
        <div className={styles.content}>
          <p role="status">
            {pending ? "Working in the local engine…" : notice}
          </p>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <details open className={styles.section}>
            <summary>Components</summary>
            <label>
              Search full catalog
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setEntry("");
                }}
                disabled={fieldDisabled}
              />
            </label>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const item = catalog[Number(entry)];
                if (entry === "" || !item) return;
                await mutate(
                  "add_part",
                  { type: item.type, properties: item.properties },
                  "Added " + item.title + ".",
                );
              }}
            >
              <label>
                Catalog component
                <select
                  aria-label="Catalog component"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  disabled={fieldDisabled}
                >
                  <option value="">Choose component</option>
                  {catalog
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) =>
                      (item.title + " " + item.type + " " + item.category)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map(({ item, index }) => (
                      <option key={index} value={index}>
                        {item.title} · {item.category}
                      </option>
                    ))}
                </select>
              </label>
              <Button type="submit" disabled={fieldDisabled || entry === ""}>
                Add component
              </Button>
            </form>
          </details>
          <details open className={styles.section}>
            <summary>Inspector &amp; code</summary>
            <label>
              Inspect component
              <select
                aria-label="Inspect component"
                value={selected}
                disabled={fieldDisabled}
                onChange={(e) => void inspect(e.target.value)}
              >
                <option value="">Choose placed component</option>
                {partOptions}
              </select>
            </label>
            {current && info && (
              <>
                <p>{info.description}</p>
                <p>Native simulation model: {info.simulation}</p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await mutate(
                        "set_part_properties",
                        {
                          part: current.id,
                          label,
                          properties: {
                            ...properties,
                            ...(current.type.startsWith("arduino_") ||
                            current.code !== undefined
                              ? { code }
                              : {}),
                          },
                        },
                        "Applied inspector changes.",
                      )
                    )
                      setDirty(false);
                  }}
                >
                  <label>
                    Component label
                    <input
                      value={label}
                      maxLength={80}
                      disabled={fieldDisabled}
                      onChange={(e) => {
                        setLabel(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  {info.propertyDefinitions.map((def) => (
                    <label key={def.key}>
                      {def.label}
                      {def.options ? (
                        <select
                          aria-label={def.label}
                          value={properties[def.key] || ""}
                          disabled={fieldDisabled}
                          onChange={(e) => {
                            setProperties({
                              ...properties,
                              [def.key]: e.target.value,
                            });
                            setDirty(true);
                          }}
                        >
                          {!def.options.includes(properties[def.key] || "") && (
                            <option value={properties[def.key] || ""}>
                              {properties[def.key] || "Not set"}
                            </option>
                          )}
                          {def.options.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label={def.label}
                          value={properties[def.key] || ""}
                          maxLength={256}
                          disabled={fieldDisabled}
                          onChange={(e) => {
                            setProperties({
                              ...properties,
                              [def.key]: e.target.value,
                            });
                            setDirty(true);
                          }}
                        />
                      )}
                    </label>
                  ))}
                  {(current.type.startsWith("arduino_") ||
                    current.code !== undefined) && (
                    <label>
                      Arduino sketch
                      <textarea
                        aria-label="Arduino sketch"
                        rows={12}
                        value={code}
                        maxLength={65536}
                        spellCheck={false}
                        disabled={fieldDisabled}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                  )}
                  <Button type="submit" disabled={fieldDisabled || !dirty}>
                    Apply inspector changes
                  </Button>
                </form>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const px = Number(x),
                      py = Number(y);
                    if (
                      !Number.isFinite(px) ||
                      !Number.isFinite(py) ||
                      Math.abs(px) > 1000000 ||
                      Math.abs(py) > 1000000
                    ) {
                      setError(
                        "Coordinates must be finite, within ±1,000,000 mils.",
                      );
                      return;
                    }
                    await mutate(
                      "move_part",
                      { part: current.id, x: px, y: py, view },
                      "Moved component.",
                    );
                  }}
                >
                  <div className={styles.row}>
                    <label>
                      Placement view
                      <select
                        aria-label="Placement view"
                        value={view}
                        disabled={fieldDisabled}
                        onChange={(e) => {
                          const name = e.target.value;
                          setView(name);
                          setX(String(current.views?.[name]?.at[0] || 0));
                          setY(String(current.views?.[name]?.at[1] || 0));
                        }}
                      >
                        {["breadboard", "schematic", "pcb"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      X (mils)
                      <input
                        type="number"
                        required
                        min={-1000000}
                        max={1000000}
                        value={x}
                        onChange={(e) => setX(e.target.value)}
                        disabled={fieldDisabled}
                      />
                    </label>
                    <label>
                      Y (mils)
                      <input
                        type="number"
                        required
                        min={-1000000}
                        max={1000000}
                        value={y}
                        onChange={(e) => setY(e.target.value)}
                        disabled={fieldDisabled}
                      />
                    </label>
                  </div>
                  <Button type="submit" disabled={fieldDisabled}>
                    Move component
                  </Button>
                </form>
                <Button
                  variant="outline"
                  disabled={fieldDisabled}
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Remove this component and its attached wires? Undo can restore it.",
                      )
                    ) {
                      if (
                        await mutate(
                          "remove_part",
                          { part: current.id },
                          "Removed component.",
                        )
                      ) {
                        setSelected("");
                        setInfo(null);
                        setDirty(false);
                      }
                    }
                  }}
                >
                  Remove component
                </Button>
              </>
            )}
          </details>
          <details className={styles.section}>
            <summary>Wiring</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!from || !to || !fromPin || !toPin) return;
                await mutate(
                  "connect",
                  {
                    from_part: Number(from),
                    from_pin: fromPin,
                    to_part: Number(to),
                    to_pin: toPin,
                    views: ["breadboard", "schematic", "pcb"],
                  },
                  "Connected terminals in all three views.",
                );
              }}
            >
              <div className={styles.row}>
                <label>
                  From component
                  <select
                    aria-label="From component"
                    value={from}
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setFromPin("");
                    }}
                  >
                    <option value="">Choose component</option>
                    {partOptions}
                  </select>
                </label>
                <label>
                  From pin
                  <select
                    aria-label="From pin"
                    value={fromPin}
                    disabled={fieldDisabled}
                    onChange={(e) => setFromPin(e.target.value)}
                  >
                    <option value="">Choose pin</option>
                    {pins(from).map((pin) => (
                      <option key={pin}>{pin}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.row}>
                <label>
                  To component
                  <select
                    aria-label="To component"
                    value={to}
                    disabled={fieldDisabled}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setToPin("");
                    }}
                  >
                    <option value="">Choose component</option>
                    {partOptions}
                  </select>
                </label>
                <label>
                  To pin
                  <select
                    aria-label="To pin"
                    value={toPin}
                    disabled={fieldDisabled}
                    onChange={(e) => setToPin(e.target.value)}
                  >
                    <option value="">Choose pin</option>
                    {pins(to).map((pin) => (
                      <option key={pin}>{pin}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Button
                type="submit"
                disabled={
                  fieldDisabled ||
                  !from ||
                  !to ||
                  !fromPin ||
                  !toPin ||
                  (from === to && fromPin === toPin)
                }
              >
                Connect pins
              </Button>
            </form>
            <ul>
              {document.wires.map((wire) => (
                <li key={wire.id}>
                  {wire.view} wire #{wire.id}
                  <Button
                    variant="outline"
                    disabled={fieldDisabled}
                    onClick={() =>
                      void mutate(
                        "remove_wire",
                        { wire: wire.id },
                        "Removed wire.",
                      )
                    }
                  >
                    Remove wire {wire.id}
                  </Button>
                </li>
              ))}
            </ul>
          </details>
          <Button
            variant="outline"
            disabled={fieldDisabled}
            onClick={() => {
              if (discard()) void load();
            }}
          >
            Refresh from canvas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
