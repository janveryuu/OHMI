// Rebuild native assets first, then derive validation metadata from that exact runtime.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(
    (process.env.OHMI_TEST_ORIGIN || "http://127.0.0.1:3140") +
      "/app/vendor/design-electronics/index.html",
  );
  await page.waitForFunction(
    () => {
      try {
        return JSON.parse(
          Module.ccall(
            "de_ohmi_dispatch",
            "string",
            ["string"],
            ['{"operation":"status"}'],
          ),
        ).result.ready;
      } catch {
        return false;
      }
    },
    { timeout: 30000 },
  );
  const entries = await page.evaluate(
    () =>
      JSON.parse(
        Module.ccall(
          "de_ohmi_dispatch",
          "string",
          ["string"],
          ['{"operation":"catalog"}'],
        ),
      ).result,
  );
  assert.equal(entries.length, 791);
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../public/vendor/design-electronics/engine-manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await writeFile(
    new URL("../src/lib/playground/electronics-catalog.json", import.meta.url),
    JSON.stringify({ upstream: manifest.upstream, entries }, null, 2) + "\n",
  );
  const legacy = await page.evaluate(() => {
    const call = (request) => {
      const result = JSON.parse(
        Module.ccall(
          "de_ohmi_dispatch",
          "string",
          ["string"],
          [JSON.stringify(request)],
        ),
      );
      if (!result.ok) throw new Error(result.error);
      return result.result;
    };
    call({ operation: "tool", name: "new_design", arguments: {} });
    for (const type of ["battery", "resistor", "led", "switch"])
      call({ operation: "tool", name: "add_part", arguments: { type } });
    return call({ operation: "snapshot" }).library;
  });
  await writeFile(
    new URL("../src/lib/playground/legacy-native-parts.json", import.meta.url),
    JSON.stringify(legacy, null, 2) + "\n",
  );
  console.log(`${entries.length} native catalog entries exported.`);
} finally {
  await browser.close();
}
