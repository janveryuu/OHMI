import type { Project } from "./model";
export type History = { past: Project[]; present: Project; future: Project[] };
export function commit(h: History, p: Project): History {
  return JSON.stringify(p) === JSON.stringify(h.present)
    ? h
    : { past: [...h.past, h.present].slice(-60), present: p, future: [] };
}
export function undo(h: History): History {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  return h.future.length
    ? {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
