import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startAuthFixture, seedSession } from "./auth-fixture.mjs";
const origin = "http://127.0.0.1:3140",
  evidence = new URL(
    "../../docs/playground-upgrade/evidence/",
    import.meta.url,
  );
const catalog = JSON.parse(
  await readFile(
    new URL("../src/lib/playground/electronics-catalog.json", import.meta.url),
    "utf8",
  ),
);
const sketch = JSON.parse(
  await readFile(new URL("uno-blink.dez", evidence), "utf8"),
).parts[0].code;
const fixture = await startAuthFixture(),
  browser = await chromium.launch({ headless: true }),
  report = { checks: [], errors: [], viewports: [] };
try {
  fixture.state.electronics = { projects: new Map(), legacy: new Map() };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await seedSession(context);
  await context.route("http://127.0.0.1:54329/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "access-control-allow-origin": origin },
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  const start = performance.now();
  await page.goto(origin + "/app/playground/electronics/");
  const trigger = page.getByRole("button", {
    name: "Parts & inspector",
    exact: true,
  });
  await trigger.waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Parts & inspector" && !b.disabled,
      ),
    { timeout: 45000 },
  );
  report.coldLocalReadyMs = Math.round(performance.now() - start);
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Circuit tools" });
  await sheet.waitFor();
  await sheet
    .getByText("791 native catalog entries.", { exact: false })
    .waitFor();
  assert.equal(
    await sheet
      .getByLabel("Catalog component", { exact: true })
      .locator("option")
      .count(),
    792,
  );
  for (const type of ["arduino_uno", "resistor", "led"]) {
    const index = catalog.entries.findIndex((entry) => entry.type === type);
    await sheet
      .getByLabel("Catalog component", { exact: true })
      .selectOption(String(index));
    await sheet
      .getByRole("button", { name: "Add component", exact: true })
      .click();
    await sheet.getByRole("status").filter({ hasText: "Added" }).waitFor();
  }
  await sheet.getByLabel("Search full catalog").fill("no such component");
  assert.equal(
    await sheet
      .getByLabel("Catalog component", { exact: true })
      .locator("option")
      .count(),
    1,
  );
  await sheet.getByLabel("Search full catalog").fill("");
  const selectId = async (type) =>
    sheet
      .getByLabel("Inspect component", { exact: true })
      .locator("option")
      .filter({ hasText: type })
      .first()
      .getAttribute("value");
  const unoId = await selectId("arduino_uno"),
    resistorId = await selectId("resistor"),
    ledId = await selectId("led");
  await sheet
    .getByLabel("Inspect component", { exact: true })
    .selectOption(unoId);
  await sheet.getByLabel("Arduino sketch", { exact: true }).fill(sketch);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  assert.equal(await sheet.isVisible(), true);
  assert.equal(
    await sheet.getByLabel("Arduino sketch", { exact: true }).inputValue(),
    sketch,
  );
  await sheet
    .getByRole("button", { name: "Apply inspector changes", exact: true })
    .click();
  await sheet
    .getByRole("status")
    .filter({ hasText: "Applied inspector changes" })
    .waitFor();
  await sheet
    .getByLabel("Inspect component", { exact: true })
    .selectOption(resistorId);
  const resistance = sheet.getByLabel("Resistance", { exact: true });
  await resistance.waitFor();
  if ((await resistance.evaluate((el) => el.tagName)) === "SELECT") {
    const value = await resistance
      .locator("option")
      .filter({ hasText: /^220/ })
      .first()
      .evaluate((el) => el.value);
    await resistance.selectOption(value);
  } else await resistance.fill("220");
  await sheet
    .getByRole("button", { name: "Apply inspector changes", exact: true })
    .click();
  await sheet
    .getByRole("status")
    .filter({ hasText: "Applied inspector changes" })
    .waitFor();
  await sheet.getByLabel("X (mils)", { exact: true }).fill("3200");
  await sheet.getByLabel("Y (mils)", { exact: true }).fill("0");
  await sheet
    .getByRole("button", { name: "Move component", exact: true })
    .click();
  await sheet
    .getByRole("status")
    .filter({ hasText: "Moved component" })
    .waitFor();
  await sheet.getByText("Wiring", { exact: true }).click();
  for (const [from, fromPin, to, toPin] of [
    [unoId, "D13", resistorId, "pin0"],
    [resistorId, "pin1", ledId, "anode"],
    [ledId, "cathode", unoId, "GND"],
  ]) {
    await sheet
      .getByLabel("From component", { exact: true })
      .selectOption(from);
    await sheet.getByLabel("From pin", { exact: true }).selectOption(fromPin);
    await sheet.getByLabel("To component", { exact: true }).selectOption(to);
    await sheet.getByLabel("To pin", { exact: true }).selectOption(toPin);
    await sheet
      .getByRole("button", { name: "Connect pins", exact: true })
      .click();
    await sheet
      .getByRole("status")
      .filter({ hasText: "Connected terminals" })
      .waitFor();
  }
  const axe = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  report.axe = axe.violations;
  assert.deepEqual(axe.violations, []);
  report.checks.push(
    "full791 catalog/presets, empty search, no-drag add/move/wire, code/property edits, unapplied-change guard, scoped axe",
  );
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .dez", exact: true })
    .click();
  const dez = JSON.parse(await readFile(await (await download).path(), "utf8"));
  assert.equal(
    dez.parts.filter((part) => part.type === "arduino_uno").length,
    1,
  );
  assert.equal(dez.wires.length, 9);
  assert.equal(
    dez.parts.find((part) => part.type === "arduino_uno").code,
    sketch,
  );
  assert.equal(
    parseFloat(
      dez.parts.find((part) => part.type === "resistor").props.resistance,
    ),
    220,
  );
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await page.getByText("Simulation running", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByText("Simulation paused", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.getByRole("button", { name: "Fit circuit", exact: true }).click();
  await page.getByRole("button", { name: "Schematic", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Schematic", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  report.checks.push(
    "focus restoration, exact sketch/document, live native running/view state, DOM zoom controls",
  );
  for (const [name, width, height, dark] of [
    ["desktop-light", 1440, 1100, false],
    ["desktop-dark", 1440, 1100, true],
    ["tablet-dark", 820, 1180, true],
    ["mobile-dark", 390, 844, true],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("button", { name: "Fit circuit", exact: true })
      .click();
    if (
      (await page.evaluate(
        () => document.documentElement.dataset.theme === "dark",
      )) !== dark
    )
      await page
        .getByRole("button", { name: "Toggle appearance", exact: true })
        .click();
    await page.evaluate(() => {
      document.activeElement?.blur();
      scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForTimeout(350);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: fileURLToPath(new URL("m4-" + name + ".png", evidence)),
      fullPage: true,
    });
    if (name === "mobile-dark") {
      await page
        .getByRole("button", { name: "Focus canvas", exact: true })
        .tap();
      await page
        .getByRole("button", { name: "Return to controls", exact: true })
        .waitFor();
      const canvas = await page
        .getByTitle("designElectronics circuit editor")
        .boundingBox();
      assert.ok(
        canvas.y >= 65 && canvas.y + canvas.height <= height - 90,
        JSON.stringify(canvas),
      );
      await page.screenshot({
        path: fileURLToPath(new URL("m4-mobile-canvas-focus.png", evidence)),
      });
      await page
        .getByRole("button", { name: "Return to controls", exact: true })
        .tap();
      assert.equal(
        await page
          .getByRole("button", { name: "Focus canvas", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
    await trigger.tap();
    await sheet.waitFor();
    const bounds = await sheet.boundingBox();
    assert.ok(
      bounds.x >= -1 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.height <= height,
      JSON.stringify({ name, bounds, width, height }),
    );
    await page.screenshot({
      path: fileURLToPath(new URL("m4-" + name + "-tools.png", evidence)),
    });
    const sizes = await sheet
      .locator("button:visible,input:visible,select:visible,summary:visible")
      .evaluateAll((items) =>
        items.map((el) => ({
          tag: el.tagName,
          height: el.getBoundingClientRect().height,
        })),
      );
    assert.ok(
      sizes.every((size) => size.height >= 43.5),
      JSON.stringify(sizes),
    );
    report.viewports.push({ name, width, height, dialog: bounds });
    await sheet.getByRole("button", { name: "Close", exact: true }).tap();
  }
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  report.checks.push(
    "desktop/tablet/mobile, emulated touch,44px sheet targets,reduced motion,theme persistence",
  );
  assert.deepEqual(report.errors, []);
  await writeFile(
    new URL("m4-browser.json", evidence),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const context of browser.contexts())
    await context.unrouteAll({ behavior: "wait" });
  await browser.close();
  await fixture.close();
}
