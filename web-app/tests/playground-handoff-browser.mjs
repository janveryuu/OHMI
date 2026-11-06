// Regression: Ask OHMI "Arduino with 5 LEDs" -> Build in Playground must render the
// requested circuit (not a blank "Loading electronics engine…" canvas), survive
// refresh and repeat navigation, and offer recovery when the engine cannot load.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { startAuthFixture, seedSession } from "./auth-fixture.mjs";

const origin = process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3115";
const shots = process.env.OHMI_SHOT_DIR || "";
const fixture = await startAuthFixture();
const browser = await chromium.launch({
  headless: !process.env.OHMI_HEADED,
  ...(process.env.OHMI_CHANNEL ? { channel: process.env.OHMI_CHANNEL } : {}),
});
const throttleKbps = Number(process.env.OHMI_THROTTLE_KBPS || 0);
const report = { checks: [], errors: [] };
const check = (name) => { report.checks.push(name); console.log("PASS", name); };

async function engineState(page) {
  // The engine runs inside a sandboxed srcdoc frame; inspect it from the frame itself.
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith("about:srcdoc"));
  if (!frame) return null;
  return frame.evaluate(() => {
    const status = document.getElementById("status");
    const call = (request) => {
      try { return JSON.parse(window.Module.ccall("de_ohmi_dispatch", "string", ["string"], [JSON.stringify(request)])); }
      catch { return null; }
    };
    const snap = call({ operation: "snapshot" });
    let doc = snap?.result?.document ?? snap?.result ?? null;
    if (typeof doc === "string") { try { doc = JSON.parse(doc); } catch {} }
    return {
      statusHidden: Boolean(status?.hidden),
      statusText: status?.textContent || "",
      ready: Boolean(call({ operation: "status" })?.result?.ready),
      doc,
    };
  }).catch(() => null);
}

async function waitForCircuit(page, label, minLeds) {
  const deadline = Date.now() + Number(process.env.OHMI_CIRCUIT_TIMEOUT || 45000);
  let last = null;
  while (Date.now() < deadline) {
    last = await engineState(page);
    if (last?.ready && last.statusHidden) {
      const parts = Array.isArray(last.doc?.parts) ? last.doc.parts : [];
      const wires = Array.isArray(last.doc?.wires) ? last.doc.wires.length : 0;
      const leds = parts.filter((p) => /led/i.test(JSON.stringify(p).slice(0, 300))).length;
      if (leds >= minLeds && wires > 0) return { parts: parts.length, leds, wires };
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`${label}: circuit did not render. Last engine state: ${JSON.stringify({ ...last, doc: last?.doc ? "[doc]" : null })}`);
}

try {
  const [vw, vh] = (process.env.OHMI_VIEWPORT || "1440x1000").split("x").map(Number);
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.OHMI_DPR || 1) });
  await context.addInitScript(() => {
    window.__frameLoads = 0;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) {
        const frames = n.nodeType === 1 ? (n.tagName === "IFRAME" ? [n] : [...n.querySelectorAll("iframe")]) : [];
        for (const f of frames) { window.__frameLoads++; }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await seedSession(context);
  await context.route("http://127.0.0.1:54329/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": origin } });
  });
  fixture.state.ai = {
    conversationId: "22222222-2222-4222-8222-222222222222",
    messages: [], jobs: [], posts: [],
    result: { status: "answer", answer: "Here is an Arduino Uno with five LEDs, each through its own resistor." },
  };
  fixture.state.electronics = { projects: new Map(), legacy: new Map() };
  const page = await context.newPage();
  if (throttleKbps) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: throttleKbps * 128, uploadThroughput: throttleKbps * 128 });
  }
  page.on("console", (m) => { if (process.env.OHMI_VERBOSE) console.log("console", m.type(), m.text()); });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("dialog", (d) => d.accept());

  // 1. Ask OHMI -> circuit card -> Build in Playground (client-side navigation).
  await page.goto(origin + "/app/ask/");
  await page.locator('textarea[name="message"]').fill("Hi ohmi can you build me a arduino with 5 LEDs?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const build = page.getByRole("button", { name: "Build in Playground", exact: true });
  await build.waitFor({ timeout: 30000 });
  await build.click();
  await page.waitForURL(/\/app\/playground\/\?template=custom/, { timeout: 20000 });
  const handoffStart = Date.now();
  await page.getByRole("status").filter({ hasText: /electronics engine/ }).first().waitFor({ timeout: 5000 }).then(() => check("loading overlay visible during engine start")).catch(() => {});
  const first = await waitForCircuit(page, "handoff", 5);
  first.ms = Date.now() - handoffStart;
  first.frameInsertions = await page.evaluate(() => window.__frameLoads);
  if (shots) await page.screenshot({ path: shots + "/handoff.png" });
  check(`handoff renders circuit (${JSON.stringify(first)})`);
  const firstDoc = JSON.stringify((await engineState(page)).doc);
  assert.ok(!/traffic/i.test(firstDoc.slice(0, 4000)) || /LED/i.test(firstDoc), "handoff must not silently load an unrelated template");

  // 2. Refresh (SSR markup: iframe can finish loading before hydration).
  await page.reload();
  const refreshed = await waitForCircuit(page, "refresh", 5);
  check(`refresh renders circuit (${JSON.stringify(refreshed)})`);
  if (shots) await page.screenshot({ path: shots + "/refresh.png" });

  // 3. Repeat navigation: away and back via the sidebar, then the full Ask flow again.
  await page.goto(origin + "/app/");
  await page.getByRole("link", { name: /Playground/ }).first().click();
  await page.waitForURL(/\/app\/playground\//, { timeout: 20000 });
  await waitForCircuit(page, "sidebar return", 1);
  check("sidebar return renders a circuit");
  for (let i = 0; i < 2; i++) {
    fixture.state.ai.messages = [];
    await page.goto(origin + "/app/ask/");
    await page.locator('textarea[name="message"]').fill("Build Arduino with five LEDs");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByRole("button", { name: "Build in Playground", exact: true }).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Build in Playground", exact: true }).first().click();
    await page.waitForURL(/template=custom/, { timeout: 20000 });
    await waitForCircuit(page, "repeat " + i, 5);
    check("repeat handoff " + (i + 1) + " renders circuit");
  }

  // 4. Recovery: block the engine binary; a useful error and Reload must appear, then recover.
  let block = true;
  await context.route("**/vendor/design-electronics/designElectronics.wasm", (route) => (block ? route.abort() : route.continue()));
  await page.reload();
  const overlay = page.locator('[role="alert"]').filter({ hasText: "electronics engine didn" }).first();
  await overlay.waitFor({ timeout: 40000 });
  check("blocked engine shows recovery overlay: " + (await overlay.innerText()).replace(/\s+/g, " ").slice(0, 140));
  if (shots) await page.screenshot({ path: shots + "/error.png" });
  block = false;
  await overlay.getByRole("button", { name: "Retry engine", exact: true }).click();
  await waitForCircuit(page, "after reload", 5);
  check("Reload engine recovers the handed-off circuit");

  // The deliberately blocked engine binary aborts inside the frame; anything else is a regression.
  report.errors = report.errors.filter((e) => !/fetching of the wasm failed/.test(e));
  assert.deepEqual(report.errors, [], "page errors: " + report.errors.join("; "));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await fixture.close?.();
}
