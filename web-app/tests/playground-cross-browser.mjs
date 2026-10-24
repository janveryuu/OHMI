import { chromium, firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.OHMI_TEST_URL || "http://127.0.0.1:3120/app";
const out = "docs/screenshots/cross-browser";
await mkdir(out, { recursive: true });

const results = [];
const browsers = [
  { name: "Chromium (Desktop & Mobile)", launcher: chromium, available: true },
  { name: "Firefox", launcher: firefox, available: false },
  { name: "WebKit (Playwright engine)", launcher: webkit, available: false },
];

console.log(`Starting Cross-Browser Qualification against: ${base}/playground/`);

for (const b of browsers) {
  let instance;
  try {
    instance = await b.launcher.launch();
    b.available = true;
  } catch (e) {
    b.available = false;
    results.push({
      browser: b.name,
      status: "BLOCKED/NOT INSTALLED",
      detail: e.message.split("\n")[0],
    });
    console.log(`[SKIP] ${b.name}: Executable not installed in local environment`);
    continue;
  }

  console.log(`[RUN] ${b.name}: Executing responsive and accessibility scans...`);
  const viewports = [
    { name: "mobile-320", width: 320, height: 600 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1024", width: 1024, height: 768 },
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "landscape-844", width: 844, height: 390 },
  ];

  for (const vp of viewports) {
    for (const theme of ["light", "dark"]) {
      const context = await instance.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`${base}/playground/`);
      await page.locator(".playground[data-ready=true]").waitFor();

      if (theme === "dark") {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
      }

      const axe = await new AxeBuilder({ page })
        .include(".playground")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      results.push({
        browser: b.name,
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        theme,
        status: axe.violations.length === 0 ? "PASS" : "FAIL",
        violations: axe.violations.map((v) => ({ id: v.id, description: v.description })),
      });
      await context.close();
    }
  }

  // Functional interactive check on Chromium
  const functionalContext = await instance.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const fPage = await functionalContext.newPage();
  await fPage.goto(`${base}/playground/`);
  await fPage.locator(".playground[data-ready=true]").waitFor();

  // Test switch toggling and check circuit
  await fPage.getByRole("button", { name: "Missions", exact: true }).click();
  await fPage.locator(".pg-mission-picker button").filter({ hasText: "Find the hidden issue" }).click();
  await fPage.getByRole("button", { name: "Check circuit", exact: true }).click();
  await fPage.getByText("Potential damage warning", { exact: true }).waitFor();
  await functionalContext.close();

  await instance.close();
}

await writeFile("docs/cross-browser-results.json", JSON.stringify(results, null, 2));
console.log(`Cross-browser qualification complete. Results saved to docs/cross-browser-results.json`);
