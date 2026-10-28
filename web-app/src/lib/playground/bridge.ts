import { PROTOCOL, validateRequest } from "../../../public/vendor/design-electronics/protocol.mjs";

export type EngineRequest = { operation: string; [key: string]: unknown };
export type EngineStatus = { ready: boolean; catalogCount: number; protocol: number };

export class ElectronicsBridge {
  private port: MessagePort;
  private nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private closed = false;
  private startup: ReturnType<typeof setTimeout>;
  constructor(frame: HTMLIFrameElement, onReady: (status: EngineStatus) => void, onError: (error: string) => void) {
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.startup = setTimeout(() => { onError("The engine did not load. Check your connection and reload it."); this.close(); }, 30000);
    this.port.onmessage = ({ data }) => {
      if (this.closed || data?.protocol !== PROTOCOL) return;
      if (data.kind === "failed") { onError("The electronics engine stopped. Reload it to continue."); this.close(); return; }
      if (data.kind === "ready") { clearTimeout(this.startup); onReady(data.result); return; }
      if (data.nonce !== this.nonce || !Number.isSafeInteger(data.id)) return;
      const target = this.pending.get(data.id);
      if (!target) return;
      clearTimeout(target.timer); this.pending.delete(data.id);
      if (data.ok) target.resolve(data.result);
      else target.reject(new Error(typeof data.error === "string" ? data.error : "Engine operation failed."));
    };
    this.port.start();
    // Sandboxed frames have opaque origins; the transferred port is the capability.
    frame.contentWindow?.postMessage({ kind: "ohmi-engine-init", protocol: PROTOCOL, nonce: this.nonce }, "*", [channel.port2]);
  }
  request<T = unknown>(request: EngineRequest): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Engine session is closed."));
    try { validateRequest(request); } catch (error) { return Promise.reject(error); }
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("The engine did not respond. Reload it before continuing.")); }, 15000);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      this.port.postMessage({ protocol: PROTOCOL, nonce: this.nonce, id, request });
    });
  }
  close() {
    clearTimeout(this.startup);
    this.closed = true; this.port.close();
    for (const target of this.pending.values()) { clearTimeout(target.timer); target.reject(new Error("Engine session ended.")); }
    this.pending.clear();
  }
}
