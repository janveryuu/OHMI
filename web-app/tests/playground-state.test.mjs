import test from "node:test";
import assert from "node:assert/strict";
import {
  newPart,
  connect,
  validateProject,
  emptyProject,
} from "../src/lib/playground/model.ts";
import { commit, undo, redo } from "../src/lib/playground/history.ts";
test("terminal connections reject duplicates, self-wires and unknown terminals", () => {
  const p = emptyProject();
  p.parts = [newPart("battery", "b", 48, 48), newPart("led", "l", 240, 48)];
  const a = connect(p, { part: "b", pin: "p" }, { part: "l", pin: "a" }, "w");
  assert.equal(a.wires.length, 1);
  assert.throws(() =>
    connect(a, { part: "l", pin: "a" }, { part: "b", pin: "p" }, "w2"),
  );
  assert.throws(() =>
    connect(a, { part: "b", pin: "p" }, { part: "b", pin: "p" }, "w3"),
  );
  assert.throws(() =>
    connect(a, { part: "b", pin: "x" }, { part: "l", pin: "a" }, "w4"),
  );
});
test("project boundary rejects invalid coordinates, unsafe structure and dangling wires", () => {
  const p = emptyProject();
  p.parts = [newPart("led", "l", 0, 0)];
  assert.doesNotThrow(() => validateProject(p));
  assert.throws(() =>
    validateProject({ ...p, parts: [{ ...p.parts[0], x: NaN }] }),
  );
  assert.throws(() =>
    validateProject({
      ...p,
      wires: [
        {
          id: "w",
          from: { part: "missing", pin: "a" },
          to: { part: "l", pin: "k" },
        },
      ],
    }),
  );
  assert.throws(() =>
    validateProject({ ...p, parts: Array(41).fill(p.parts[0]) }),
  );
});
test("undo redo restores exact electrical state and truncates redo after new edit", () => {
  const p = emptyProject();
  let h = { past: [], present: p, future: [] };
  h = commit(h, { ...p, parts: [newPart("battery", "b", 0, 0)] });
  assert.equal(h.present.parts.length, 1);
  h = undo(h);
  assert.equal(h.present.parts.length, 0);
  h = redo(h);
  assert.equal(h.present.parts.length, 1);
  h = undo(h);
  h = commit(h, { ...p, name: "New edit" });
  assert.equal(redo(h).present.name, "New edit");
  assert.equal(h.future.length, 0);
});
