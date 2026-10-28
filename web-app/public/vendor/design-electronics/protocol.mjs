export const PROTOCOL = 1;
export const MAX_BYTES = 1024 * 1024;
export const TOOLS = new Set(["list_parts", "get_part_info", "get_design", "new_design", "load_example", "add_part", "set_part_properties", "move_part", "place_on_breadboard", "remove_part", "remove_wire", "connect", "autoroute", "run_drc"]);

export function boundedJson(value, maxBytes = MAX_BYTES) {
  const pending = [[value, 0]];
  let count = 0;
  while (pending.length) {
    const [item, depth] = pending.pop();
    if (++count > 60000 || depth > 24) throw new Error("Document structure is too large.");
    if (typeof item === "number" && (!Number.isFinite(item) || Math.abs(item) > 10000000)) throw new Error("Invalid number.");
    if (typeof item === "string" && item.length > 65536) throw new Error("Text is too large.");
    if (item !== null && typeof item === "object") {
      for (const [key, child] of Object.entries(item)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid object key.");
        pending.push([child, depth + 1]);
      }
    } else if (!["string", "number", "boolean"].includes(typeof item) && item !== null) throw new Error("Unsupported value.");
  }
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error("Document exceeds the bridge size limit.");
  return text;
}

export function validateRequest(request) {
  boundedJson(request);
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("Invalid bridge request.");
  const fields = {
    status: [], snapshot: [], undo: [], redo: [],
    tool: ["name", "arguments"], open: ["document"], observe: ["seconds"],
    theme: ["theme"], view: ["view"], running: ["running"], export: ["format", "view"],
  };
  if (!Object.hasOwn(fields, request.operation) || Object.keys(request).some(key => !["operation", ...fields[request.operation]].includes(key))) throw new Error("Unsupported bridge operation or field.");
  if (request.operation === "tool" && (!TOOLS.has(request.name) || !request.arguments || typeof request.arguments !== "object" || Array.isArray(request.arguments))) throw new Error("Tool is not allowed.");
  if (request.operation === "theme" && !["light", "dark"].includes(request.theme)) throw new Error("Invalid theme.");
  if (request.operation === "view" && ![0, 1, 2].includes(request.view)) throw new Error("Invalid view.");
  if (request.operation === "running" && typeof request.running !== "boolean") throw new Error("Invalid simulation state.");
  if (request.operation === "observe" && (typeof request.seconds !== "number" || request.seconds < 0.05 || request.seconds > 5)) throw new Error("Observation must be 0.05 to 5 seconds.");
  if (request.operation === "export" && (!["svg", "bom", "netlist", "spice", "gerber"].includes(request.format) || !["breadboard", "schematic", "pcb"].includes(request.view))) throw new Error("Invalid export options.");
  if (request.operation === "open") {
    const doc = request.document;
    if (!doc || doc.format !== "designElectronics" || doc.version !== 1 || !Array.isArray(doc.parts) || !Array.isArray(doc.wires) || doc.parts.length > 200 || doc.wires.length > 800) throw new Error("Unsupported or oversized .dez document.");
  }
  return request;
}
