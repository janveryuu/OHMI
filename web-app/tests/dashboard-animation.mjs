import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startAuthFixture, seedSession } from "./auth-fixture.mjs";

const base = "http://127.0.0.1:3136/app/";
const output = new URL("../test-results/dashboard-animation/", import.meta.url);
await mkdir(output, { recursive: true });
const baseline = process.env.OHMI_MASCOT_BASELINE === "1";
const fixture = await startAuthFixture();
const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext();
  await seedSession(context);
  await context.route("http://127.0.0.1:54329/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": new URL(base).origin } });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const geometry = {};
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.waitForLoadState("networkidle");
    await page.locator(".welcome-mascot").waitFor();
    await page.waitForTimeout(baseline ? 6000 : 1000);
    geometry[width] = await page.evaluate(() => Object.fromEntries([".welcome-panel", ".welcome-copy", ".welcome-visual", ".welcome-mascot", ".orbit-one", ".orbit-two", ".hello-note"].map((selector) => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return [selector, { x, y, width, height }];
    })));
    if (!baseline) {
      await page.waitForFunction(() => document.querySelector(".dashboard-mascot")?.dataset.playing === "true");
      const state = await page.locator(".dashboard-mascot video").evaluate((video) => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(video, 0, 0);
        return { muted: video.muted, defaultMuted: video.defaultMuted, loop: video.loop, inline: video.playsInline, controls: video.controls, paused: video.paused, duration: video.duration, corner: ctx.getImageData(0, 0, 1, 1).data[3], body: ctx.getImageData(240, 240, 1, 1).data[3] };
      });
      assert.deepEqual(state, { muted: true, defaultMuted: true, loop: true, inline: true, controls: false, paused: false, duration: 4, corner: 0, body: 255 });
    }
    await page.locator(".welcome-panel").screenshot({ path: fileURLToPath(new URL(`${baseline ? "before" : "after"}-${width}.png`, output)) });
  }
  if (baseline) {
    await writeFile(new URL("before.json", output), JSON.stringify(geometry, null, 2));
  } else {
    const before = JSON.parse(await readFile(new URL("../design/dashboard-animation/hero-geometry.json", import.meta.url), "utf8"));
    for (const width of Object.keys(before)) for (const selector of Object.keys(before[width])) for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(before[width][selector][key] - geometry[width][selector][key]) < .1, `${width} ${selector} ${key} changed`);
    const video = page.locator(".dashboard-mascot video");
    await video.evaluate((node) => { window.__looped = false; node.addEventListener("timeupdate", () => { if (node.currentTime < 1) window.__looped = true; }); node.currentTime = 3.8; });
    await page.waitForFunction(() => window.__looped === true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => !document.querySelector(".dashboard-mascot video"));
    assert.equal(await page.locator(".dashboard-mascot img").evaluate((node) => getComputedStyle(node).visibility), "visible");
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".dashboard-mascot video").count(), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector(".dashboard-mascot")?.dataset.playing === "true");
    await page.route("**/animations/dashboard-ohmi.webm", (route) => route.abort());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => !document.querySelector(".dashboard-mascot video"));
    assert.equal(await page.locator(".dashboard-mascot img").evaluate((node) => getComputedStyle(node).visibility), "visible");
    await page.evaluate(() => localStorage.setItem("ohmi-preferences", JSON.stringify({ reduceMotion: true })));
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".dashboard-mascot video").count(), 0);
    await page.unroute("**/animations/dashboard-ohmi.webm");
    await page.addInitScript(() => {
      localStorage.setItem("ohmi-preferences", JSON.stringify({ theme: "dark", reduceMotion: false }));
      const original = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        const result = original.apply(this, args);
        if (args[2] === 1 && args[3] === 1) result.data[3] = 255;
        return result;
      };
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => !document.querySelector(".dashboard-mascot video"));
    assert.equal(await page.locator(".dashboard-mascot img").evaluate((node) => getComputedStyle(node).visibility), "visible");
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL(`${baseline ? "baseline" : "verification"}.json`, output), JSON.stringify({ geometry, errors, baseline }, null, 2));
  console.log(baseline ? "Baseline recorded at four widths." : "Animation, alpha, silence, loop, unchanged geometry, reduced motion and failure fallback passed at four widths.");
} finally {
  await browser.close();
  await fixture.close();
}
