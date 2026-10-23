import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { validateFile, cropRect, lessonProgress } from "../src/lib/demo.mjs";

test("file boundary accepts only declared PDF, PNG or JPEG up to 10 MiB", () => {
  assert.equal(
    validateFile({ name: "lab.pdf", type: "application/pdf", size: 1024 }),
    null,
  );
  assert.match(
    validateFile({ name: "lab.svg", type: "image/svg+xml", size: 4 }),
    /PDF/,
  );
  assert.match(
    validateFile({
      name: "lab.png",
      type: "image/png",
      size: 11 * 1024 * 1024,
    }),
    /10 MB/,
  );
  assert.match(
    validateFile({ name: "empty.png", type: "image/png", size: 0 }),
    /empty/,
  );
  assert.match(
    validateFile({ name: "lab.html", type: "image/png", size: 5 }),
    /extension/,
  );
});
test("crop stays centered and bounded at extremes", () => {
  assert.deepEqual(cropRect(1000, 500, 100), {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });
  assert.deepEqual(cropRect(1000, 500, 50), {
    x: 250,
    y: 125,
    width: 500,
    height: 250,
  });
  assert.deepEqual(cropRect(1000, 500, 200), {
    x: 0,
    y: 0,
    width: 1000,
    height: 500,
  });
});
test("lesson progress derives from completed steps and handles empty guide", () => {
  assert.equal(lessonProgress([true, false, true]), 67);
  assert.equal(lessonProgress([]), 0);
});

test("app worker ignores landing, private requests and RSC; only public app assets install", async () => {
  const handlers = {}, installed = [];
  runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), {
    URL,
    self: { location: { origin: "https://meetohmi.vercel.app", pathname: "/app/sw.js" }, addEventListener: (name, handler) => handlers[name] = handler },
    caches: { open: async () => ({ addAll: async urls => installed.push(...urls) }) },
  });
  let install;
  handlers.install({ waitUntil: promise => install = promise });
  await install;
  assert.equal(installed.length, 6);
  assert.ok(installed.every(url => url.startsWith("/app/")));
  for (const [path, method] of [["/", "GET"], ["/app/ask/?_rsc=123", "GET"], ["/app/api/private", "POST"], ["/application/", "GET"]]) {
    handlers.fetch({ request: { url: "https://meetohmi.vercel.app" + path, method, mode: "navigate" }, respondWith: () => assert.fail("Worker intercepted " + path) });
  }
});

test("legacy worker retires only its old cache and registration without navigating clients", async () => {
  const handlers = {}, deleted = [];
  let unregistered = false, activation;
  runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { pathname: "/sw.js" }, addEventListener: (name, handler) => handlers[name] = handler, registration: { unregister: async () => unregistered = true } },
    caches: { keys: async () => ["ohmi-public-shell-v1", "ohmi-app-public-shell-v2", "unrelated"], delete: async name => deleted.push(name) },
  });
  handlers.activate({ waitUntil: promise => activation = promise });
  await activation;
  assert.deepEqual(deleted, ["ohmi-public-shell-v1"]);
  assert.equal(unregistered, true);
});
