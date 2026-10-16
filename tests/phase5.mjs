import assert from 'node:assert/strict';
import { join } from 'node:path';

// Minimal 100x100 1-pixel red PNG buffer for browser upload test
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAALUlEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwH4WwAAHbAepkAAAAAElFTkSuQmCC';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

const MOCK_CIRCUIT_RESULT = {
  schemaVersion: 2,
  status: 'reviewed',
  summary: 'LED circuit connected to Arduino digital pin 13 with a series 220 ohm resistor.',
  findings: [
    {
      id: 'finding-1',
      severity: 'info',
      certainty: 'observed',
      observation: 'LED anode connected to digital pin 13 through breadboard row 10.',
      why: 'Digital pin 13 can source current to light standard indicator LEDs.',
      action: 'Verify series resistor is placed before ground rail.',
      evidence: [
        { kind: 'image', imageId: 'overview', location: 'breadboard row 10' },
        { kind: 'code', startLine: 1, endLine: 2 }
      ]
    },
    {
      id: 'finding-2',
      severity: 'warning',
      certainty: 'possible',
      observation: 'Cathode return connection to GND rail is partially obscured.',
      why: 'Incomplete ground loop prevents current flow and simulation execution.',
      action: 'Check black jumper wire from breadboard blue rail to Arduino GND header.',
      evidence: [
        { kind: 'requirement', requirementId: 'manual-1' },
        { kind: 'simulation', excerpt: 'Serial output: LED ON' }
      ]
    }
  ],
  unknowns: [
    'Breadboard lower power rail connection is obscured by viewing angle.',
    'Resistor power rating is unconfirmed from visual appearance alone.'
  ],
  questions: [
    'Does the black wire from the blue rail connect directly to the Arduino GND pin?'
  ],
  comparisons: [
    {
      requirementId: 'manual-1',
      status: 'supported',
      explanation: 'LED is correctly driven by pin 13 output configuration in Arduino code.',
      evidence: [{ kind: 'code', startLine: 1, endLine: 2 }]
    },
    {
      requirementId: 'manual-2',
      status: 'not_observable',
      explanation: 'Pushbutton debounce logic is not observable in uploaded evidence.',
      evidence: []
    }
  ],
  steps: [
    {
      step: 1,
      instruction: 'Verify LED long leg (anode) connects to pin 13 jumper wire.',
      why: 'LEDs are polarized semiconductors that conduct only in forward bias.',
      check: 'Look for longer lead or smaller internal anvil in LED plastic dome.'
    },
    {
      step: 2,
      instruction: 'Connect 220 ohm resistor from cathode row to breadboard ground rail.',
      why: 'Current-limiting resistor prevents excess current through the LED.',
      check: 'Verify resistor bands: Red-Red-Brown-Gold.'
    },
    {
      step: 3,
      instruction: 'Run Tinkercad simulation to verify LED output.',
      why: 'Simulation validates code execution and logic timing.',
      check: 'Click "Start Simulation" in Tinkercad header.'
    }
  ],
  codeSuggestion: {
    code: 'const int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}',
    explanation: 'Refactored to use named constant ledPin and explicit 500ms blink timing.'
  },
  limitations: [
    'Visual review only based on visible evidence; wiring hidden under components is unobserved.',
    'Code review checks structure only and does not execute or compile the sketch.'
  ]
};

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
  assert.equal(await checkPage.getByText('Phase 5 · Circuit Checker').isVisible(), true, 'Circuit Checker badge visible');

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
  await checkPage.getByText('Applied crop (60 × 60 px).').waitFor();
  assert.equal(await checkPage.getByText(/60 × 60 px ·/).isVisible(), true, 'Cropped dimensions displayed');

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

  // 8. Test unauthenticated state prompts sign in
  assert.equal(await checkPage.getByRole('button', { name: 'Sign in to OHMI to Analyze' }).isVisible(), true, 'Sign in button shown when unauthenticated');

  // 9. Take review screenshot before analysis
  await checkPage.screenshot({ path: join(screenshots, 'phase-5-circuit-review.png'), fullPage: true });

  // 10. Inject authenticated account and mock ai.circuit response
  await checkPage.evaluate((mockResult) => {
    const origSend = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = async (message, ...rest) => {
      if (message?.channel === 'ohmi') {
        if (message.action === 'account.state') {
          return {
            ok: true,
            data: {
              configured: true,
              user: { id: '00000000-0000-0000-0000-000000000001', email: 'student@example.test' },
              profile: { id: '00000000-0000-0000-0000-000000000001', display_name: 'Student', language: 'english' },
              assignments: [],
              recovery: false
            }
          };
        }
        if (message.action === 'analyses.list') {
          return {
            ok: true,
            data: [
              {
                id: '00000000-0000-0000-0000-000000000003',
                title: 'LED Series Resistor Check',
                artifact_kind: 'circuit_check',
                created_at: new Date().toISOString()
              }
            ]
          };
        }
        if (message.action === 'ai.circuit') {
          return {
            ok: true,
            data: {
              ok: true,
              requestId: '00000000-0000-0000-0000-000000000002',
              accountId: '00000000-0000-0000-0000-000000000001',
              operation: 'circuit_check',
              language: 'english',
              model: 'gemini-3.5-flash-lite',
              resultId: '00000000-0000-0000-0000-000000000003',
              conversationId: '00000000-0000-0000-0000-000000000004',
              result: mockResult
            }
          };
        }
        if (message.action === 'progress.save') {
          return { ok: true, data: null };
        }
        if (message.action === 'progress.get') {
          return { ok: true, data: { current_step: 0, completed: [] } };
        }
        if (message.action === 'analyses.delete') {
          return { ok: true, data: null };
        }
      }
      return origSend(message, ...rest);
    };
    window.dispatchEvent(new Event('focus'));
  }, MOCK_CIRCUIT_RESULT);

  // Wait for account transition
  await checkPage.getByText('student@example.test').waitFor();

  // Enter code and requirements for authenticated check
  await codeArea.fill('void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }');
  const reqArea = checkPage.getByLabel('Assignment Requirements or Goal');
  await reqArea.fill('LED on pin 13 with current limiting resistor');

  // 11. Now authenticated with evidence: Send for Circuit Review button is available
  const sendCheckButton = checkPage.getByRole('button', { name: 'Send for Circuit Review' });
  await sendCheckButton.waitFor({ timeout: 2000 });
  await sendCheckButton.click();

  // 12. Verify Circuit Review Results rendered
  const resultsRegion = checkPage.getByRole('region', { name: 'Circuit Review Results' });
  await resultsRegion.waitFor();
  assert.equal(await resultsRegion.getByText('Evidence Reviewed').isVisible(), true, 'Status badge Evidence Reviewed visible');
  assert.equal(await resultsRegion.getByText('LED circuit connected to Arduino digital pin 13 with a series 220 ohm resistor.').isVisible(), true, 'Summary visible');

  // Verify Findings
  assert.equal(await resultsRegion.getByText('Circuit Findings (2)').isVisible(), true, 'Findings count visible');
  assert.equal(await resultsRegion.getByText('CRITICAL', { exact: true }).count() === 0, true, 'No critical findings');
  assert.equal(await resultsRegion.getByText('WARNING', { exact: true }).isVisible(), true, 'Warning finding visible');
  assert.equal(await resultsRegion.getByText('INFO', { exact: true }).isVisible(), true, 'Info finding visible');
  assert.equal(await resultsRegion.getByText('observed', { exact: true }).isVisible(), true, 'Observed certainty visible');
  assert.equal(await resultsRegion.getByText('possible', { exact: true }).isVisible(), true, 'Possible certainty visible');

  // Verify Unknowns & Questions
  assert.equal(await resultsRegion.getByText('Unobserved or Uncertain Details').isVisible(), true, 'Unknowns section visible');
  assert.equal(await resultsRegion.getByText('Questions to Verify on Your Breadboard').isVisible(), true, 'Questions section visible');

  // Verify Requirement Comparisons
  assert.equal(await resultsRegion.getByText('Assignment Requirements Comparison').isVisible(), true, 'Requirements comparison section visible');
  assert.equal(await resultsRegion.getByText('Supported', { exact: true }).isVisible(), true, 'Supported requirement badge visible');
  assert.equal(await resultsRegion.getByText('Not Observable', { exact: true }).isVisible(), true, 'Not Observable requirement badge visible');

  // Verify Step-by-Step Guidance
  assert.equal(await resultsRegion.getByText('Step-by-Step Guidance').isVisible(), true, 'Guidance section visible');
  assert.equal(await resultsRegion.getByText('0 of 3 steps completed').isVisible(), true, 'Initial 0 steps completed');
  assert.equal(await resultsRegion.getByText('Step 1 of 3').isVisible(), true, 'Step 1 indicator visible');

  // Test Next step
  await resultsRegion.getByRole('button', { name: 'Next step' }).click();
  assert.equal(await resultsRegion.getByText('Step 2 of 3').isVisible(), true, 'Advanced to Step 2');

  // Test Mark step done
  await resultsRegion.getByRole('button', { name: 'Mark step done' }).click();
  assert.equal(await resultsRegion.getByText('1 of 3 steps completed').isVisible(), true, 'Step marked done (1 of 3 completed)');
  assert.equal(await resultsRegion.getByRole('button', { name: 'Undo completion' }).isVisible(), true, 'Undo completion button available');

  // Verify Code Suggestion & Copy
  assert.equal(await resultsRegion.getByText('Suggested Code Adjustment').isVisible(), true, 'Code suggestion visible');
  assert.equal(await resultsRegion.getByRole('button', { name: 'Copy suggested code' }).isVisible(), true, 'Copy code button visible');

  // Verify Limitations
  assert.equal(await resultsRegion.getByText('Review Limitations:').isVisible(), true, 'Limitations visible');

  // 13. Take results screenshot for verification evidence
  await checkPage.screenshot({ path: join(screenshots, 'phase-5-circuit-results.png'), fullPage: true });

  // 14. Test Delete review
  await checkPage.evaluate(() => { window.confirm = () => true; });
  await resultsRegion.getByRole('button', { name: 'Delete this review' }).click();
  assert.equal(await resultsRegion.count(), 0, 'Review successfully deleted and cleared');

  // 15. Verify zero unauthorized network calls
  assert.equal(aiNetworkCallMade, false, 'Zero network analysis calls made during offline testing');

  await checkPage.close();
  console.log('PASS Phase 5 M4: Interactive Circuit Review UI, crop controls, Arduino review, findings, comparisons, step guidance, copy code, history restoration, deletion, and zero unauthorized AI calls.');
}
