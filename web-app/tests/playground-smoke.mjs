import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3120/app/playground/");
  await page
    .getByRole("heading", { name: "Playground", exact: true })
    .waitFor();
  const place = async (name, x, y) => {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("region", { name: "Circuit workbench" })
      .click({ position: { x, y } });
  };
  await place("DC supply", 90, 90);
  await place("Resistor", 270, 90);
  await place("Red LED", 450, 90);
  assert.equal(await page.locator("[data-part]").count(), 3);
  await page.getByRole("button", { name: /DC supply .* terminal \+/ }).click();
  await page.getByRole("button", { name: /Resistor .* terminal A/ }).click();
  await page.getByRole("button", { name: /Resistor .* terminal B/ }).click();
  await page.getByRole("button", { name: /Red LED .* terminal A/ }).click();
  await page.getByRole("button", { name: /Red LED .* terminal K/ }).click();
  await page.getByRole("button", { name: /DC supply .* terminal −/ }).click();
  await page
    .getByRole("button", { name: "Check circuit", exact: true })
    .click();
  await page.getByText("Expected LED behavior", { exact: true }).waitFor();
  assert.match(await page.locator(".pg-feedback").innerText(), /9.09/);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".pg-wire").count(), 2);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.equal(await page.locator(".pg-wire").count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    "M2/M3 browser: placement, terminal wiring, 9.09mA, undo/redo pass",
  );
} finally {
  await browser.close();
}
