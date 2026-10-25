import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const base = process.env.OHMI_TEST_URL || "http://127.0.0.1:3120/app";
const outDir = "docs";
await mkdir(outDir, { recursive: true });

console.log(`Starting Playground performance qualification against: ${base}/playground/`);

const runs = [];
for (let i = 1; i <= 3; i++) {
  console.log(`--- Cold Mobile Run ${i}/3 ---`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  let jsBytes = 0;
  let totalBytes = 0;
  page.on("response", (res) => {
    const size = Number(res.headers()["content-length"] || 0);
    totalBytes += size;
    const type = res.headers()["content-type"] || "";
    if (type.includes("javascript")) {
      jsBytes += size;
    }
  });

  const start = Date.now();
  await page.goto(`${base}/playground/`, { waitUntil: "networkidle" });
  await page.locator(".playground[data-ready=true]").waitFor();

  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      let lcp = 0;
      let cls = 0;
      try {
        const po = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) lcp = lastEntry.startTime;
        });
        po.observe({ type: "largest-contentful-paint", buffered: true });
      } catch (e) {}

      try {
        const poCls = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        });
        poCls.observe({ type: "layout-shift", buffered: true });
      } catch (e) {}

      setTimeout(() => {
        const nav = performance.getEntriesByType("navigation")[0] || {};
        const paint = performance.getEntriesByType("paint") || [];
        const fcp = paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0;
        resolve({
          fcp,
          lcp: lcp || fcp,
          cls,
          domContentLoaded: nav.domContentLoadedEventEnd,
          load: nav.loadEventEnd,
          duration: nav.duration,
        });
      }, 500);
    });
  });

  await browser.close();
  runs.push({
    run: i,
    fcpMs: metrics.fcp,
    lcpMs: metrics.lcp,
    cls: metrics.cls,
    jsTransferBytes: jsBytes,
    totalTransferBytes: totalBytes,
  });
  console.log(`Run ${i}: FCP=${metrics.fcp.toFixed(1)}ms, LCP=${metrics.lcp.toFixed(1)}ms, CLS=${metrics.cls.toFixed(4)}, JS=${(jsBytes / 1024).toFixed(1)}KB`);
}

// Compute medians
const sortedLcp = [...runs].sort((a, b) => a.lcpMs - b.lcpMs);
const medianLcp = sortedLcp[Math.floor(runs.length / 2)].lcpMs;
const sortedFcp = [...runs].sort((a, b) => a.fcpMs - b.fcpMs);
const medianFcp = sortedFcp[Math.floor(runs.length / 2)].fcpMs;

const summary = {
  fetchTime: new Date().toISOString(),
  targetLcpMs: 2500,
  targetFcpMs: 1800,
  runs,
  medianLcpMs: medianLcp,
  medianFcpMs: medianFcp,
  contractTargetMet: medianLcp <= 2500 && medianFcp <= 1800,
};

await writeFile(`${outDir}/playground-performance-summary.json`, JSON.stringify(summary, null, 2));
console.log(`Summary written to ${outDir}/playground-performance-summary.json`);
console.log(`Median LCP: ${medianLcp.toFixed(1)}ms (Target <=2500ms: ${medianLcp <= 2500 ? "PASS" : "FAIL"})`);
console.log(`Median FCP: ${medianFcp.toFixed(1)}ms (Target <=1800ms: ${medianFcp <= 1800 ? "PASS" : "FAIL"})`);
