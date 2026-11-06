import { PROTOCOL, MAX_BYTES, boundedJson, validateRequest } from "./protocol.mjs";

const status = document.getElementById("status");
let ready = false, channel = null, lastId = 0;
const emit = message => channel?.postMessage(message);
const announce = (kind, detail) => { try { parent?.postMessage({ kind, protocol: PROTOCOL, ...detail }, "*"); } catch {} };
let failed = false;
const sentence = text => { const t = String(text || "").trim().replace(/\s+/g, " ").slice(0, 160); return t ? ": " + t.replace(/[.!]$/, "") + "." : "."; };
const fail = text => {
  if (failed || ready) return;
  failed = true;
  status.hidden = false;
  status.textContent = text;
  emit({ kind: "failed", protocol: PROTOCOL, reason: text });
  announce("ohmi-loader-failed", { reason: text });
};
// Record (do not act on) early errors; they explain a later start-up failure.
let lastError = "";
window.addEventListener("error", event => { if (!ready) lastError = String(event.message || "").slice(0, 160); });
window.addEventListener("unhandledrejection", event => { if (!ready) lastError = String(event.reason?.message || event.reason || "").slice(0, 160); });
const engine = request => {
  validateRequest(request);
  const response = JSON.parse(Module.ccall("de_ohmi_dispatch", "string", ["string"], [JSON.stringify(request)]));
  boundedJson(response, 2 * MAX_BYTES);
  if (!response.ok) throw new Error(response.error || "Engine operation failed.");
  return response.result;
};
window.addEventListener("message", event => {
  if (event.source !== parent || event.data?.kind !== "ohmi-engine-init" || event.data.protocol !== PROTOCOL || !/^[a-f0-9]{32}$/.test(event.data.nonce) || event.ports.length !== 1) return;
  if (channel) {
    try { channel.close(); } catch {}
  }
  channel = event.ports[0];
  const nonce = event.data.nonce;
  channel.onmessage = ({ data }) => {
    if (!data || data.protocol !== PROTOCOL || data.nonce !== nonce || !Number.isSafeInteger(data.id) || data.id <= lastId) return;
    lastId = data.id;
    try {
      if (!ready) throw new Error("Engine is still loading.");
      if (data.request?.operation === "theme" && typeof data.request.theme === "string") {
        document.documentElement.dataset.theme = data.request.theme;
        document.body.dataset.theme = data.request.theme;
      }
      const result = engine(data.request);
      if (data.request.operation === "export" && data.request.format === "gerber") {
        const bytes = Module.FS.readFile("/tmp/ohmi-export.zip");
        if (bytes.byteLength > 2 * MAX_BYTES) throw new Error("Export exceeds the bridge download limit. Use the native export menu.");
        const buffer = bytes.slice().buffer;
        channel.postMessage({ protocol: PROTOCOL, nonce, id: data.id, ok: true, result: { buffer } }, [buffer]);
      } else emit({ protocol: PROTOCOL, nonce, id: data.id, ok: true, result });
    } catch (error) {
      emit({ protocol: PROTOCOL, nonce, id: data.id, ok: false, error: error.message || "Engine operation failed." });
    }
  };
  channel.start();
  emit({ kind: "connected", protocol: PROTOCOL, nonce, ready });
  if (failed) emit({ kind: "failed", protocol: PROTOCOL, reason: status.textContent });
  if (ready) emit({ kind: "ready", protocol: PROTOCOL, nonce, result: engine({ operation: "status" }) });
});
try {
  parent?.postMessage({ kind: "ohmi-loader-ready", protocol: PROTOCOL }, "*");
} catch {}
window.Module = {
  canvas: document.getElementById("canvas"),
  locateFile: name => new URL(name, import.meta.url).href,
  print: () => {},
  printErr: () => {},
  setStatus(text) {
    // Emscripten reports "Downloading data... (loaded/total)" while fetching the engine.
    const match = /\((\d+)\/(\d+)\)/.exec(text || "");
    const progress = match && Number(match[2]) > 0 ? Math.min(1, Number(match[1]) / Number(match[2])) : null;
    if (!ready && !failed && progress !== null) status.textContent = "Downloading electronics engine… " + Math.round(progress * 100) + "%";
    announce("ohmi-loader-progress", { stage: "download", progress });
  },
  monitorRunDependencies(left) {
    announce("ohmi-loader-progress", { stage: left ? "download" : "starting", remaining: left });
  },
  onAbort(reason) {
    if (ready) {
      status.hidden = false;
      status.textContent = "The engine stopped. Reload it from OHMI; your saved projects are unchanged.";
      emit({ kind: "failed", protocol: PROTOCOL });
      announce("ohmi-loader-failed", { reason: "stopped" });
      return;
    }
    fail("The engine stopped while starting" + sentence(reason) + " Reload it from OHMI.");
  },
  onRuntimeInitialized() {
    if (!ready && !failed) status.textContent = "Starting electronics engine…";
    announce("ohmi-loader-progress", { stage: "starting" });
    try { Module.callMain([]); } catch (error) {
      if (error !== "unwind" && error?.name !== "ExitStatus") { fail("The engine could not start" + sentence(error?.message || error) + " Reload it from OHMI."); return; }
    }
    const started = performance.now();
    const check = () => {
      try {
        const result = engine({ operation: "status" });
        if (result.ready) {
          ready = true; status.hidden = true;
          emit({ kind: "ready", protocol: PROTOCOL, result });
          announce("ohmi-loader-ready-engine");
          return;
        }
      } catch { /* SDL may still be setting up its application callbacks. */ }
      if (performance.now() - started < 15000) setTimeout(check, 40);
      else fail("The engine did not start" + sentence(lastError) + " Reload it from OHMI.");
    };
    check();
  },
};
const script = document.createElement("script");
script.src = new URL("designElectronics.js", import.meta.url).href;
script.crossOrigin = "anonymous";
script.onerror = () => fail("The engine could not download. Check your connection and reload.");
document.body.appendChild(script);
