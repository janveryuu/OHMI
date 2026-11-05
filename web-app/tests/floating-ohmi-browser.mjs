import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || 3100;
const base = `http://127.0.0.1:${port}/app`;
const outDir = new URL("../test-results/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  console.log(`Navigating to ${base}/ ...`);
  const response = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Dashboard should load with HTTP 200");

  // 1. Verify Promotional Launch Card in sidebar (Section 5)
  console.log("Checking promotional launch card...");
  const promoCard = page.locator("[data-testid='companion-promo-card']");
  await promoCard.waitFor({ timeout: 10000 });

  assert.ok(
    await promoCard.getByText("Your circuit buddy, always nearby.").isVisible(),
    "Promotional card should have title 'Your circuit buddy, always nearby.'",
  );
  assert.ok(
    await promoCard.getByText("Always nearby").isVisible(),
    "Promotional card should have 'Always nearby' badge",
  );
  assert.ok(
    await promoCard
      .getByText(
        "Keep OHMI beside your workspace. Ask questions, check your wiring, and debug code without switching tabs.",
      )
      .isVisible(),
    "Promotional card should have detailed description",
  );

  const launchBtn = promoCard.getByRole("button", { name: /Launch Floating OHMI/i });
  assert.ok(await launchBtn.isVisible(), "Launch Floating OHMI button should be visible");

  // 2. Launch Floating OHMI
  console.log("Launching Floating OHMI...");
  await launchBtn.click();

  const companion = page.locator("[aria-label='Floating OHMI Companion']");
  await companion.waitFor({ timeout: 10000 });
  assert.ok(await companion.isVisible(), "Floating OHMI companion window should be visible");

  // 3. Verify Header
  const header = companion.locator("header");
  assert.ok(await header.getByText("OHMI").isVisible(), "Header must show OHMI");
  assert.ok(
    await header.getByText("Your circuit buddy").isVisible(),
    "Header must show 'Your circuit buddy'",
  );

  // 4. Verify Welcome Card matching reference design
  const welcomeCard = companion.locator("[data-testid='welcome-card']");
  assert.ok(
    await welcomeCard.getByText("Working on a circuit?").isVisible(),
    "Welcome card must show 'Working on a circuit?'",
  );
  assert.ok(
    await welcomeCard
      .getByText("Ask me anything, send a screenshot, or paste your Arduino code. I'll help right here!")
      .isVisible(),
    "Welcome card must show reference description",
  );

  // 5. Verify Troubleshooting Quick Action Pills
  const quickActions = companion.locator("[data-testid='quick-actions']");
  assert.ok(await quickActions.getByText("Circuit screenshot").isVisible(), "Quick action: Circuit screenshot");
  assert.ok(await quickActions.getByText("Check code").isVisible(), "Quick action: Check code");
  assert.ok(await quickActions.getByText("Fix my error").isVisible(), "Quick action: Fix my error");
  assert.ok(await quickActions.getByText("Explain circuit").isVisible(), "Quick action: Explain circuit");

  // 6. Test Quick Action: Check code
  console.log("Testing Check code quick action...");
  await quickActions.getByText("Check code").click();
  const textarea = companion.locator("textarea");
  const draftVal = await textarea.inputValue();
  assert.ok(draftVal.includes("Arduino sketch"), "Textarea should receive Arduino sketch template");
  assert.ok(draftVal.includes("void setup()"), "Textarea should include void setup()");

  // 7. Test Quick Action: Fix my error
  console.log("Testing Fix my error quick action...");
  await textarea.fill("");
  await quickActions.getByText("Fix my error").click();
  const errorDraft = await textarea.inputValue();
  assert.ok(errorDraft.includes("I'm encountering this error"), "Textarea should receive error troubleshooting prompt");

  // 8. Test Workspace context selection
  console.log("Testing Workspace context dropdown...");
  const contextSelect = companion.locator("select");
  await contextSelect.selectOption("Arduino IDE");
  assert.equal(await contextSelect.inputValue(), "Arduino IDE");

  // 9. Take snapshot of Floating OHMI
  const screenshotPath = fileURLToPath(new URL("../test-results/floating-ohmi-preview.png", import.meta.url));
  await companion.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to ${screenshotPath}`);

  // 10. Test History Drawer
  console.log("Testing History Drawer...");
  const historyBtn = header.getByLabel("Conversation history");
  await historyBtn.click();
  const drawer = companion.locator("[role='dialog'][aria-label='Conversation history']");
  await drawer.waitFor({ timeout: 5000 });
  assert.ok(await drawer.getByText("Your Conversations").isVisible(), "Drawer should show 'Your Conversations'");
  assert.ok(await drawer.getByRole("button", { name: "New chat" }).isVisible(), "Drawer should have 'New chat' button");
  await drawer.getByRole("button", { name: "Close History" }).click();
  await drawer.waitFor({ state: "hidden", timeout: 5000 });

  // 11. Test Minimize & Restore
  console.log("Testing Minimize & Restore...");
  const minBtn = header.getByLabel("Minimize companion");
  await minBtn.click();

  const pill = page.locator(".floating-ohmi-minimized-pill");
  await pill.waitFor({ timeout: 5000 });
  assert.ok(await pill.isVisible(), "Minimized pill dock should be visible");
  assert.ok(await pill.getByText("OHMI").isVisible(), "Pill should show OHMI");

  // Click pill to restore
  await pill.click();
  await companion.waitFor({ timeout: 5000 });
  assert.ok(await companion.isVisible(), "Companion window should be restored");

  // 12. Test Close
  console.log("Testing Close companion...");
  const closeBtn = companion.locator("header").getByLabel("Close companion");
  await closeBtn.click();
  await companion.waitFor({ state: "hidden", timeout: 5000 });

  // Assert no fatal errors
  assert.deepEqual(errors, [], "There should be no page errors during Floating OHMI execution");
  console.log("🎉 All Floating OHMI 2.0 browser tests passed successfully!");
} finally {
  await browser.close();
}
