import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("dialog", (d) => d.accept());
try {
  await page.goto("http://127.0.0.1:3120/app/playground/");
  await page.locator(".playground[data-ready=true]").waitFor();
  const board = page.getByRole("region", { name: "Circuit workbench" });
  await page
    .getByRole("button", { name: "Resistor", exact: true })
    .dragTo(board, { targetPosition: { x: 200, y: 140 } });
  assert.equal(
    await page.locator("[data-part]").count(),
    1,
    "native tray drag/drop",
  );
  const handle = page.getByRole("button", { name: /Select Resistor/ });
  await handle.click();
  const before = Number(
    await page
      .getByRole("spinbutton", { name: "Component X position" })
      .inputValue(),
  );
  await handle.scrollIntoViewIfNeeded();
  const rect = await handle.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + 10);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 65, rect.y + 10, {
    steps: 8,
  });
  await page.mouse.up();
  assert.ok(
    Number(
      await page
        .getByRole("spinbutton", { name: "Component X position" })
        .inputValue(),
    ) > before,
    "pointer component move",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(
    Number(
      await page
        .getByRole("spinbutton", { name: "Component X position" })
        .inputValue(),
    ),
    before,
  );
  await page.getByRole("button", { name: "DC supply", exact: true }).click();
  await board.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("[data-part]").count(),
    2,
    "keyboard placement",
  );
  await page.getByText("Connect with controls", { exact: true }).click();
  const ids = await page
    .locator("[data-part]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-part")));
  await page
    .getByRole("combobox", { name: "Wire from terminal" })
    .selectOption(ids[0] + ":a");
  await page
    .getByRole("combobox", { name: "Wire to terminal" })
    .selectOption(ids[1] + ":p");
  await page.getByRole("button", { name: "Connect wire", exact: true }).click();
  assert.equal(
    await page.locator(".pg-wire").count(),
    1,
    "keyboard-accessible wiring controls",
  );
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  assert.equal(await page.locator("[data-part]").count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator("[data-part]").count(), 2);
  assert.equal(
    await page.locator(".pg-wire").count(),
    1,
    "clear undo restores electrical graph",
  );
  console.log(
    "PASS native tray drag/drop, pointer move, keyboard placement, native-control wiring, clear/undo",
  );
} finally {
  await browser.close();
}
