import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const base = (process.env.OHMI_TEST_URL || "http://127.0.0.1:3115/app").replace(
  /\/$/,
  "",
);
const out = new URL("../test-results/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage(),
  errors = [],
  violations = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (
    r.status() >= 400 &&
    !r.url().includes("/api/") &&
    !r.url().includes("supabase.co")
  )
    errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
});
const routes = [
  "/",
  "/ask/",
  "/assignments/",
  "/checker/",
  "/guide/",
  "/progress/",
  "/settings/",
];
try {
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const route of routes) {
      assert.equal((await page.goto(base + route)).status(), 200);
      await page.locator("h1").waitFor();
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "light",
        "New users start light even on dark devices",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${route} overflow ${size.width}`,
      );
    }
    if (size.width < 768) {
      await page
        .getByRole("button", { name: "More navigation", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      assert.ok(
        box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= size.width + 1 &&
          box.y + box.height <= size.height + 1,
        JSON.stringify({ size, box }),
      );
      assert.equal(await page.locator(".bottom-nav .nav-item").count(), 5);
      await page.screenshot({
        path: fileURLToPath(new URL(`more-${size.width}.png`, out)),
      });
      await page.keyboard.press("Escape");
    }
    results.push(`Routes and navigation fit ${size.width}x${size.height}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ["light", "dark"]) {
    await page.goto(base + "/settings/");
    await page
      .getByRole("button", {
        name: theme === "dark" ? "Dark" : "Light",
        exact: true,
      })
      .click();
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator("h1").waitFor();
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      violations.push(
        ...audit.violations.map((v) => ({
          theme,
          route,
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
    }
  }
  await page.goto(base + "/ask/");
  await page
    .getByRole("button", {
      name: "Why does an LED need a resistor?",
      exact: true,
    })
    .click();
  await page
    .getByText("Sign in to ask OHMI and save your conversation.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".message").count(), 0);
  await page.goto(base + "/assignments/");
  assert.equal(
    await page
      .getByRole("button", { name: "Choose files", exact: true })
      .isDisabled(),
    true,
  );
  const id = "00000000-0000-4000-8000-000000000000";
  for (const [route, method] of [
    [`/api/files/${id}/`, "GET"],
    ["/api/files/", "POST"],
    ["/api/guide/", "POST"],
  ]) {
    const response = await page.request.fetch(base + route, {
      method,
      headers: { Origin: new URL(base).origin },
      data: method === "POST" ? {} : undefined,
    });
    assert.equal(response.status(), 401);
    assert.match(response.headers()["cache-control"], /private.*no-store/);
  }
  const badOrigin = await page.request.post(base + "/api/files/", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  assert.equal(badOrigin.status(), 400);
  results.push(
    "Signed-out private APIs reject access; foreign origins rejected; no demo answer",
  );
  await page.goto(base + "/checker/");
  await page
    .locator("input[type=file]")
    .setInputFiles(
      fileURLToPath(new URL("../public/icons/icon-512.png", import.meta.url)),
    );
  await page.getByLabel("Centered crop", { exact: false }).fill("60");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await page.getByRole("button", { name: "Crop applied" }).waitFor();
  await page
    .getByRole("button", { name: "Review circuit", exact: true })
    .click();
  await page
    .getByText("Sign in to review a circuit and save findings.")
    .waitFor();
  results.push(
    "Local crop works; signed-out review produces no fabricated findings",
  );
  await page.goto(base + "/settings/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("switch", { name: "Reduce motion", exact: false })
    .check();
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(
    await page.locator("html").getAttribute("data-reduce-motion"),
    "true",
  );
  results.push("Saved theme and accessibility preferences survive refresh");
  const manifest = await (
    await page.request.get(base + "/manifest.webmanifest")
  ).json();
  assert.equal(manifest.scope, "/app/");
  assert.equal(manifest.start_url, "/app/");
  assert.equal(manifest.display, "standalone");
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    if (new URL(r.scope).pathname !== "/app/")
      throw Error("Worker scope escaped app");
  });
  const cachePaths = await page.evaluate(async () => {
    const paths = [];
    for (const key of await caches.keys())
      for (const request of await (await caches.open(key)).keys())
        paths.push(new URL(request.url).pathname);
    return paths;
  });
  const allowed = [
    "/app/offline.html",
    "/app/mascot.png",
    "/app/icons/icon-192.png",
    "/app/icons/icon-512.png",
    "/app/icons/icon-maskable-512.png",
    "/app/icons/apple-touch-icon.png",
  ];
  assert.ok(cachePaths.includes("/app/offline.html"));
  assert.ok(
    cachePaths.every((p) => allowed.includes(p)),
    JSON.stringify(cachePaths),
  );
  await context.setOffline(true);
  await page.goto(base + "/");
  await page
    .getByRole("heading", { name: "A little pause in the connection." })
    .waitFor();
  await context.setOffline(false);
  results.push(
    "Manifest, worker scope, public-only cache and offline fallback pass",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(violations, []);
} finally {
  await writeFile(
    new URL("report.json", out),
    JSON.stringify(
      {
        base,
        verifiedAt: new Date().toISOString(),
        results,
        errors,
        violations,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(JSON.stringify({ results, errors, violations }, null, 2));
