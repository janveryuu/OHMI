import { startAuthFixture, seedSession } from "./auth-fixture.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.OHMI_TEST_URL || "http://127.0.0.1:3115/app",
  out = "test-results/playground";
await mkdir(out, { recursive: true });
const fixture = await startAuthFixture();
const browser = await chromium.launch(),
  results = [],
  errors = [],
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage();
await seedSession(context);
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const check = () =>
  page.getByRole("button", { name: "Check circuit", exact: true }).click();
const mission = async (title) => {
  await page.getByRole("button", { name: "Missions", exact: true }).click();
  await page
    .locator(".pg-mission-picker button")
    .filter({ hasText: title })
    .click();
};
try {
  await page.goto(base + "/playground/");
  await page.locator(".playground[data-ready=true]").waitFor();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: out + "/empty-desktop.png", fullPage: true });
  await mission("Find the hidden issue");
  await check();
  await page.getByText("Potential damage warning", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Get a hint", exact: true }).click();
  assert.match(
    await page.locator(".pg-hints").innerText(),
    /Check the circuit/,
  );
  await page.getByRole("button", { name: /Select Resistor/ }).click();
  await page
    .getByRole("spinbutton", { name: "Resistance (Ω)", exact: true })
    .fill("330");
  await check();
  await page
    .getByText("Mission complete. Nicely connected.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Select Resistor/ }).focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Component Y position" })
      .inputValue(),
    "96",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: /Select Resistor/ }).click();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Component Y position" })
      .inputValue(),
    "72",
  );
  await page
    .getByRole("button", { name: "Delete component", exact: true })
    .click();
  assert.equal(await page.locator("[data-part]").count(), 2);
  assert.equal(await page.locator(".pg-wire").count(), 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".pg-wire").count(), 3);
  await mission("You are in control");
  await check();
  assert.match(await page.locator(".pg-feedback").innerText(), /Switch open/);
  await page.getByRole("button", { name: /Select Switch/ }).click();
  await page.getByRole("button", { name: "Close switch", exact: true }).click();
  await check();
  await page
    .getByText("Mission complete. Nicely connected.", { exact: true })
    .waitFor();
  const before = await page.locator(".pg-world").getAttribute("style");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.notEqual(
    await page.locator(".pg-world").getAttribute("style"),
    before,
  );
  await page
    .getByRole("button", { name: "Pan workbench", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Circuit workbench" })
    .scrollIntoViewIfNeeded();
  const rect = await page
      .getByRole("region", { name: "Circuit workbench" })
      .boundingBox(),
    prepan = await page.locator(".pg-world").getAttribute("style");
  await page.mouse.move(rect.x + 250, rect.y + 280);
  await page.mouse.down();
  await page.mouse.move(rect.x + 160, rect.y + 230, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(
    await page.locator(".pg-world").getAttribute("style"),
    prepan,
  );
  for (const width of [1440, 1024, 768, 390, 320, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 1000 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", { name: "Toggle appearance", exact: true })
          .click();
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `overflow ${width} ${theme}`,
      );
      const scan = await new AxeBuilder({ page })
        .include(".playground")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      results.push({
        width,
        theme,
        violations: scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `${out}/${width}-${theme}.png`,
        fullPage: true,
      });
      if (width === 390 || width === 320) {
        await page
          .getByRole("button", { name: "Select and place tool", exact: true })
          .click();
        await page
          .getByRole("combobox", { name: "Focus component" })
          .selectOption("led");
        await page
          .getByRole("region", { name: "Circuit workbench" })
          .scrollIntoViewIfNeeded();
        await page.evaluate(() => document.activeElement?.blur());
        await page.screenshot({
          path: `${out}/${width}-${theme}-workbench.png`,
        });
      }
    }
  }
  await writeFile(
    "test-results/playground/report.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(
    results.flatMap((v) => v.violations).length,
    0,
    "axe violations",
  );
  const touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    tp = await touch.newPage();
  await seedSession(touch);
  tp.on("dialog", (d) => d.accept());
  await tp.goto(base + "/playground/");
  await tp.locator(".playground[data-ready=true]").waitFor();
  await tp.getByRole("button", { name: "DC supply", exact: true }).tap();
  await tp
    .getByRole("region", { name: "Circuit workbench" })
    .tap({ position: { x: 110, y: 110 } });
  assert.equal(await tp.locator("[data-part]").count(), 1);
  const terminal = tp.getByRole("button", { name: /DC supply .* terminal \+/ }),
    tbox = await terminal.boundingBox();
  assert.ok(tbox.width >= 43.9 && tbox.height >= 43.9);
  await terminal.tap();
  assert.equal(await terminal.getAttribute("aria-pressed"), "true");
  assert.equal(
    await tp
      .getByRole("region", { name: "Circuit workbench" })
      .evaluate((el) => getComputedStyle(el).touchAction),
    "pan-y",
  );
  await tp.getByRole("button", { name: "Pan workbench", exact: true }).tap();
  assert.equal(
    await tp
      .getByRole("region", { name: "Circuit workbench" })
      .evaluate((el) => getComputedStyle(el).touchAction),
    "none",
  );
  await touch.close();
  console.log(
    "PASS: missions, hints, edits, keyboard move, delete/undo, switch states, zoom/pan, 12 theme/size scans, touch placement/terminal targets/gesture isolation",
  );
} finally {
  await browser.close();
  await fixture.close();
}
