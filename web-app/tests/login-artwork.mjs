import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

const output = "test-results/login-artwork";
await mkdir(output, { recursive: true });
const master = await sharp("public/welcome-countryside-4k.webp").metadata();
assert.equal(master.width, 3840);
assert.equal(master.height, 2160);
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 768, 1024], ["mobile", 390, 844], ["landscape", 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(theme => localStorage.setItem("ohmi-preferences", JSON.stringify({ theme })), theme);
      await page.goto("http://127.0.0.1:3115/app/login/");
      const image = page.locator(".login-countryside");
      await image.evaluate(image => image.decode());
      const src = await image.evaluate(image => image.currentSrc);
      assert.equal(new URL(src).searchParams.get("q"), "90");
      const response = await page.request.get(src);
      assert.equal(response.status(), 200);
      const delivered = await sharp(await response.body()).metadata();
      const box = await image.boundingBox();
      const requiredWidth = Math.ceil(Math.max(box.width, box.height * master.width / master.height) * 2);
      assert.ok(delivered.width >= requiredWidth, `${name}: ${delivered.width}px delivered, ${requiredWidth}px needed for 2x cover`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.getByRole("button", { name: "Continue with Google", exact: true }).waitFor();
      if (["desktop", "mobile"].includes(name)) await page.screenshot({ path: `${output}/${name}-${theme}.png`, scale: "css" });
      results.push({ name, theme, delivered: `${delivered.width}x${delivered.height}`, requiredWidth });
    }
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ master: "3840x2160", pixelRatio: 2, results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
