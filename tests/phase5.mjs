import assert from 'node:assert/strict';
import { join } from 'node:path';

// Minimal 100x100 1-pixel red PNG buffer for browser upload test
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAALUlEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwH4WwAAHbAepkAAAAAElFTkSuQmCC';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

export async function testPhase5(context, page, screenshots) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;

  // 1. Check companion "Open Circuit Review" in Tinkercad editor
  const companion = page.locator('ohmi-companion');
  const more = companion.getByRole('button', { name: 'More sections', exact: true });
  await more.click();
  await companion.getByRole('region', { name: 'More OHMI sections' }).getByRole('button', { name: 'Check My Circuit', exact: true }).click();
  const openReviewButton = companion.getByRole('button', { name: 'Open Circuit Review', exact: true });
  assert.equal(await openReviewButton.isVisible(), true, 'Open Circuit Review button exists in Check section');

  // 2. Open /check.html directly
  const checkPage = await context.newPage();
  let aiNetworkCallMade = false;
  checkPage.on('request', (req) => {
    if (req.url().includes('ohmi-ai') || req.url().includes('generativelanguage.googleapis.com')) {
      aiNetworkCallMade = true;
    }
  });

  // Open with intro flag to verify first-use intro banner
  await checkPage.goto(`chrome-extension://${extensionId}/check.html?intro=1#capture-intro`);
  await checkPage.getByRole('heading', { name: 'Review Tinkercad Circuit', exact: true }).waitFor();
  assert.equal(await checkPage.getByText('M1 Preview · AI Disconnected').isVisible(), true, 'M1 Preview badge visible');

  // Verify intro explanation banner
  const introRegion = checkPage.getByRole('region', { name: 'Capture explanation' });
  assert.equal(await introRegion.isVisible(), true, 'Capture explanation banner visible');
  await introRegion.getByRole('button', { name: 'Got it, continue to review' }).click();
  assert.equal(await introRegion.count(), 0, 'Intro banner dismissible');

  // 3. Test responsive layout on small screen
  await checkPage.setViewportSize({ width: 320, height: 600 });
  assert.equal(await checkPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Check page fits 320px viewport without overflow');

  // Return to standard desktop viewport
  await checkPage.setViewportSize({ width: 1280, height: 800 });

  // 4. Test screenshot upload
  const fileChooserPromise = checkPage.waitForEvent('filechooser');
  await checkPage.getByRole('button', { name: 'Upload screenshot (PNG / JPEG)' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'circuit-screenshot.png',
    mimeType: 'image/png',
    buffer: TEST_PNG_BUFFER,
  });

  // Wait for preview image to render
  const previewImg = checkPage.getByAltText('Captured circuit preview');
  await previewImg.waitFor();
  assert.equal(await previewImg.isVisible(), true, 'Uploaded screenshot preview rendered');
  assert.equal(await checkPage.getByText('100 × 100 px').isVisible(), true, 'Image dimensions displayed accurately');

  // 5. Test crop controls
  await checkPage.getByRole('button', { name: 'Crop image' }).click();
  await checkPage.getByText('Crop Boundaries (Pixels)').waitFor();

  // Enter numeric crop boundaries
  const widthInput = checkPage.locator('input[type="number"]').nth(2);
  await widthInput.fill('60');
  const heightInput = checkPage.locator('input[type="number"]').nth(3);
  await heightInput.fill('60');
  await checkPage.getByRole('button', { name: 'Apply Crop' }).click();

  // Verify cropped dimensions
  await checkPage.getByText('Applied crop (60 x 60 px).').waitFor();
  assert.equal(await checkPage.getByText('60 × 60 px').isVisible(), true, 'Cropped dimensions displayed');

  // 6. Test code and simulation inputs
  const codeArea = checkPage.getByLabel('Arduino Code (.ino / C++)');
  await codeArea.fill('void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }');
  assert.match(await checkPage.locator('text=/ 8,000/').innerText(), /(?:73|77) \/ 8,000/);

  const simArea = checkPage.getByLabel('Simulation Diagnostics & Serial Output');
  await simArea.fill('Serial output: LED ON');
  assert.match(await checkPage.locator('text=/ 2,000/').innerText(), /21 \/ 2,000/);

  // 7. Test board selector
  const boardSelect = checkPage.getByLabel('Declared Microcontroller Board');
  assert.equal(await boardSelect.inputValue(), 'unknown', 'Default board is unknown');
  await boardSelect.selectOption('uno-r3');
  assert.equal(await boardSelect.inputValue(), 'uno-r3');

  // 8. Verify Send button is strictly disabled in M1
  const sendButton = checkPage.getByRole('button', { name: 'Send for analysis (AI Disconnected in M1)' });
  assert.equal(await sendButton.isDisabled(), true, 'Send button disabled in Milestone 1');

  // 9. Take preview screenshot for verification evidence
  await checkPage.screenshot({ path: join(screenshots, 'phase-5-circuit-review.png'), fullPage: true });

  // 10. Test Clear all evidence
  await checkPage.getByRole('button', { name: 'Clear all evidence' }).click();
  assert.equal(await previewImg.count(), 0, 'Image preview cleared');
  assert.equal(await codeArea.inputValue(), '', 'Code input cleared');
  assert.equal(await simArea.inputValue(), '', 'Simulation input cleared');

  // 11. Verify zero external AI network calls
  assert.equal(aiNetworkCallMade, false, 'Zero network analysis calls made during preview/capture/crop');

  await checkPage.close();
  console.log('PASS Phase 5 M1: /check.html trusted review UI, local capture & upload fallback, numeric crop controls, responsive 320px layout, code & simulation inputs, disabled Send button, and zero AI network requests.');
}
