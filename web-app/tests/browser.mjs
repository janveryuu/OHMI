import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.env.OHMI_TEST_URL || "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true });
const out = new URL("../test-results/", import.meta.url);
await mkdir(out, { recursive: true });
const errors = [],
  violations = [],
  results = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
context.on("request", (request) => {
  if (
    !request.url().startsWith(base) &&
    !request.url().startsWith("blob:") &&
    !request.url().startsWith("data:")
  )
    errors.push(`Unexpected remote request: ${request.url()}`);
});
async function navigate(path) {
  await page.goto(base + path);
  await page.locator("h1").waitFor();
  await page.waitForTimeout(400);
}
async function shot(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".png", out)),
    fullPage: true,
  });
}
try {
  if (!process.env.OHMI_SKIP_MATRIX)
    for (const size of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      for (const route of [
        "/",
        "/ask",
        "/assignments",
        "/checker",
        "/guide",
        "/progress",
        "/settings",
      ]) {
        await navigate(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false, `${route} overflow at ${size.width}`);
        assert.ok(await page.locator("h1").innerText());
        if ([1440, 390].includes(size.width))
          await shot(
            `${route === "/" ? "dashboard" : route.slice(1)}-${size.width}`,
          );
      }
      results.push(`All routes fit ${size.width}x${size.height}`);
      if ([768, 390].includes(size.width)) {
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        for (const issue of audit.violations)
          violations.push({
            theme: "light",
            route: `adaptive shell at ${size.width}`,
            id: issue.id,
            impact: issue.impact,
            nodes: issue.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          });
      }
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (!process.env.OHMI_SKIP_MATRIX)
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const route of [
        "/",
        "/ask",
        "/assignments",
        "/checker",
        "/guide",
        "/progress",
        "/settings",
      ]) {
        await navigate(route);
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        for (const issue of audit.violations)
          violations.push({
            theme,
            route,
            id: issue.id,
            impact: issue.impact,
            nodes: issue.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          });
        if (theme === "dark" && ["/", "/ask", "/settings"].includes(route))
          await shot(`${route === "/" ? "dashboard" : route.slice(1)}-dark`);
      }
    }
  await writeFile(
    new URL("accessibility.json", out),
    JSON.stringify(violations, null, 2),
  );
  await page.emulateMedia({ colorScheme: "light" });
  await navigate("/ask");
  await page
    .getByRole("button", {
      name: "Why does an LED need a resistor?",
      exact: true,
    })
    .click();
  await page
    .getByRole("log")
    .getByText("An LED needs a resistor to limit current.", { exact: false })
    .waitFor();
  assert.equal(await page.getByRole("log").locator(".message").count(), 3);
  await page.getByRole("button", { name: "Expand conversation view" }).click();
  assert.equal(await page.locator(".chat-expanded").count(), 1);
  await page.getByRole("button", { name: "Restore conversation view" }).click();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByRole("button", { name: "Open conversation history" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Why does an LED need a resistor?",
      exact: false,
    })
    .click();
  assert.equal(await page.getByRole("log").locator(".message").count(), 3);
  await page.getByLabel("Your question").fill("Cancelled question");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "Stop demo" }).click();
  await page.waitForTimeout(1100);
  assert.equal(await page.getByRole("log").locator(".message").count(), 4);
  results.push("Chat presets, expand/restore, history and cancellation pass");

  await page
    .getByRole("link", { name: "Assignments", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "Your next bright idea." }).waitFor();
  await page.locator("input[type=file]").setInputFiles({
    name: "lab.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a04kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Preview lab.png" }).waitFor();
  await page.getByRole("button", { name: "Open preview" }).click();
  await page
    .getByRole("dialog")
    .getByRole("img", { name: "lab.png" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove lab.png" }).click();
  await page.getByRole("button", { name: "Keep material" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Preview lab.png" }).count(),
    1,
  );
  results.push("Assignment local add, preview and cancel removal pass");

  await page
    .getByRole("link", { name: "Circuit Checker", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Let’s look a little closer." })
    .waitFor();
  await page
    .locator("input[type=file]")
    .setInputFiles(
      fileURLToPath(new URL("../public/icons/icon-512.png", import.meta.url)),
    );
  await page.getByLabel("Centered crop", { exact: false }).waitFor();
  await page.waitForTimeout(450);
  await page.getByLabel("Centered crop", { exact: false }).fill("60");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await page.getByRole("button", { name: "Crop applied" }).waitFor();
  await page.getByRole("button", { name: "Try demo review" }).click();
  await page.getByText("Illustrative findings only.").waitFor();
  await shot("checker-result");
  await page.getByRole("button", { name: "Reset crop" }).click();
  assert.equal(
    await page.getByLabel("Centered crop", { exact: false }).inputValue(),
    "100",
  );
  results.push("Local crop, simulated findings and reset pass");

  await page
    .getByRole("link", { name: "Step-by-Step Guide", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "A little light. A big first step." })
    .waitFor();
  const titles = [
    "Meet your components",
    "Place the LED",
    "Add a current-limiting resistor",
    "Complete the path",
    "Review, then try it",
  ];
  for (let i = 0; i < 5; i++) {
    await page.getByRole("heading", { name: titles[i], exact: true }).waitFor();
    await page.getByRole("checkbox").check();
    if (i < 4) await page.getByRole("button", { name: "Next step" }).click();
  }
  await page.getByRole("link", { name: "View progress" }).click();
  await page
    .getByRole("heading", { name: "Look how far you’re going." })
    .waitFor();
  assert.equal(
    await page.getByText("Earned this session", { exact: true }).count(),
    3,
  );
  assert.equal(
    await page.getByRole("progressbar").getAttribute("value"),
    "100",
  );
  results.push("Guide completion drives progress and achievements");
  await page.evaluate(() =>
    Object.defineProperty(window, "documentPictureInPicture", {
      value: undefined,
      configurable: true,
    }),
  );
  await page
    .getByRole("button", { name: "Launch Floating OHMI", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Floating OHMI companion" })
    .getByRole("button", { name: "Ask OHMI", exact: true })
    .click();
  await page.getByRole("heading", { name: "Ask OHMI", exact: true }).waitFor();
  assert.equal(await page.getByRole("log").locator(".message").count(), 4);
  results.push("Unsupported PiP fallback routes without losing session");

  await page.evaluate(() => {
    const installEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: async () => {
        document.body.dataset.installInvoked = "true";
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(installEvent);
  });

  await page
    .getByRole("link", { name: "Settings & Profile", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "Make yourself at home." }).waitFor();
  await page.getByRole("button", { name: "Install OHMI", exact: true }).click();
  assert.equal(
    await page.locator("body").getAttribute("data-install-invoked"),
    "true",
  );
  results.push(
    "Deferred install event remains available after navigating to Settings",
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("First name").fill("Sam");
  await page.getByRole("button", { name: "Save demo profile" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page
    .getByRole("switch", { name: "Reduce motion", exact: false })
    .check();
  await page.getByRole("switch", { name: "Larger text", exact: false }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    await page.locator("html").getAttribute("data-reduce-motion"),
    "true",
  );
  await page.evaluate(() =>
    Object.defineProperty(window, "documentPictureInPicture", {
      value: undefined,
      configurable: true,
    }),
  );
  await page
    .getByRole("button", { name: "More navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Launch Floating OHMI", exact: true })
    .click();
  await page.getByRole("region", { name: "Floating OHMI companion" }).waitFor();
  await page
    .getByRole("button", { name: "Close companion", exact: true })
    .click();
  await page
    .getByRole("button", { name: "More navigation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Step-by-Step Guide" })
    .click();
  await page
    .getByRole("heading", { name: "A little light. A big first step." })
    .waitFor();
  results.push("Settings preferences persist; mobile More navigation works");

  const manifest = await (
    await page.request.get(base + "/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 3);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cacheUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    return (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (req) => new URL(req.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  assert.ok(cacheUrls.includes("/offline.html"));
  assert.ok(
    cacheUrls.every((url) =>
      [
        "/offline.html",
        "/mascot.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/icon-maskable-512.png",
        "/icons/apple-touch-icon.png",
      ].includes(url),
    ),
  );
  await context.setOffline(true);
  await page.goto(base + "/ask");
  await page
    .getByRole("heading", { name: "A little pause in the connection." })
    .waitFor();
  await context.setOffline(false);
  results.push(
    "Manifest, service worker public allowlist and offline fallback pass",
  );
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const touchPage = await touchContext.newPage();
  touchPage.on("pageerror", (error) => errors.push(error.message));
  await touchPage.goto(base + "/guide");
  await touchPage.getByRole("checkbox").tap();
  assert.equal(await touchPage.getByRole("checkbox").isChecked(), true);
  const workspace = touchPage.locator(".guide-workspace");
  await workspace.scrollIntoViewIfNeeded();
  const box = await workspace.boundingBox();
  const session = await touchContext.newCDPSession(touchPage);
  const swipeY = Math.min(700, Math.max(180, box.y + 100));
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width * 0.85, y: swipeY }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + box.width * 0.15, y: swipeY }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touchPage
    .getByRole("heading", { name: "Place the LED", exact: true })
    .waitFor();
  const moving = await touchPage.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          new Set(a.effect?.getKeyframes().map((f) => f.transform || "none"))
            .size > 1,
      )
      .map((a) => a.effect?.getKeyframes()),
  );
  assert.equal(
    moving.length,
    0,
    "Reduced motion leaves no spatial animation: " + JSON.stringify(moving),
  );
  await touchContext.close();
  results.push("Emulated mobile tap/swipe and system reduced-motion pass");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    new URL("report.json", out),
    JSON.stringify({ results, errors, violations }, null, 2),
  );
  console.log(JSON.stringify({ results, errors, violations }, null, 2));
  assert.equal(
    violations.length,
    0,
    "Accessibility violations; see test-results/report.json",
  );
} finally {
  await browser.close();
}
