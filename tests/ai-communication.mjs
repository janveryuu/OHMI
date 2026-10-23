import assert from 'node:assert/strict';

export async function testAiCommunication(context, page) {
  const companion = page.locator('ohmi-companion');
  const panel = companion.locator('.ohmi-panel');

  // 1. Verify More navigation contains Learning Progress, Check My Circuit, Settings
  const moreBtn = companion.getByRole('button', { name: 'More sections', exact: true });
  await moreBtn.click();
  const moreRegion = companion.getByRole('region', { name: 'More OHMI sections' });
  await moreRegion.waitFor();

  const progressBtn = moreRegion.getByRole('button', { name: 'Learning Progress', exact: true });
  const checkBtn = moreRegion.getByRole('button', { name: 'Check My Circuit', exact: true });
  const settingsBtn = moreRegion.getByRole('button', { name: 'Settings', exact: true });

  assert.equal(await progressBtn.isVisible(), true, 'Learning Progress is present in More');
  assert.equal(await checkBtn.isVisible(), true, 'Check My Circuit is present in More');
  assert.equal(await settingsBtn.isVisible(), true, 'Settings is present in More');

  // 2. Click Learning Progress and verify section content
  await progressBtn.click();
  await companion.getByRole('heading', { name: 'Learning Progress', exact: true }).waitFor();
  assert.equal(await companion.getByText(/Sign in to your OHMI account|Recent Activity/).isVisible(), true, 'Learning Progress view renders');

  // 3. Test Ask section with MessageContent rich formatting
  await companion.getByRole('button', { name: 'Ask section', exact: true }).click();
  await companion.getByRole('heading', { name: 'Ask OHMI', exact: true }).waitFor();

  // Verify honest demo prompt in signed-out state
  assert.equal(await companion.getByText('Local demo', { exact: true }).isVisible(), true, 'Local demo indicator visible');
  assert.equal(await companion.getByRole('button', { name: 'Send demo', exact: true }).isVisible(), true, 'Send demo button visible');

  // Send question and verify formatted markdown/code in reply
  const questionInput = companion.getByRole('textbox', { name: 'Your demo question' });
  await questionInput.fill('What does a resistor do?');
  await companion.getByRole('button', { name: 'Send demo', exact: true }).click();
  await companion.locator('.ohmi-message-ohmi').last().waitFor();

  const lastReply = companion.locator('.ohmi-message-ohmi').last();
  const replyHtml = await lastReply.innerHTML();
  assert.ok(replyHtml.includes('ohmi-message-markdown'), 'Message uses MessageContent markdown container');

  // 4. Verify Guide section navigation and step actions
  await companion.getByRole('button', { name: 'Guide section', exact: true }).click();
  await companion.getByRole('heading', { name: 'Guide Me', exact: true }).waitFor();

  // Test sample guide step actions
  assert.equal(await companion.getByText('0 of 5 done').isVisible(), true, 'Sample guide initial progress');
  assert.equal(await companion.getByText('Step 1 of 5').isVisible(), true, 'Sample guide step 1 title');
  const markDoneBtn = companion.getByRole('button', { name: 'Mark step done', exact: true });
  await markDoneBtn.click();
  assert.equal(await companion.getByText('1 of 5 done').isVisible(), true, 'Step 1 marked done');
  const undoBtn = companion.getByRole('button', { name: 'Undo completion', exact: true });
  assert.equal(await undoBtn.isVisible(), true, 'Undo completion button available');
  await undoBtn.click();
  assert.equal(await companion.getByText('0 of 5 done').isVisible(), true, 'Step 1 undone');

  console.log('PASS AI communication & More navigation: Learning Progress, truthful demo/live Ask mode, safe rich MessageContent rendering, and Guide step actions.');
}

export async function testBeginnerGuide(context) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const guidePage = await context.newPage();
  const cdp = await context.newCDPSession(guidePage);
  try {
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');

    await guidePage.goto('https://www.tinkercad.com/things/ohmi-test/editel');
    await guidePage.waitForLoadState('networkidle');
    const companion = guidePage.locator('ohmi-companion');
    const mascot = companion.locator('.ohmi-mascot');
    await mascot.waitFor();

    const isolated = worlds.find(world => world.origin === `chrome-extension://${extensionId}` && !world.auxData?.isDefault);
    assert.ok(isolated, 'Use the actual content-script context');

    const inWorld = async expression => {
      const result = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression, awaitPromise: true, returnByValue: true });
      assert.equal(result.exceptionDetails, undefined);
      return result.result.value;
    };

    await inWorld(`
      globalThis.savedProgress = { current_step: 0, completed: [] };
      globalThis.chatRequests = [];
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => {
        if (message?.channel === 'ohmi') {
          if (message.action === 'account.state') {
            return {
              ok: true,
              data: {
                configured: true,
                user: { id: 'guide-user-1', email: 'guide.student@example.test' },
                profile: { id: 'guide-user-1', display_name: 'Guide Student', language: 'english' },
                assignments: [
                  {
                    id: 'assign-guide-1',
                    original_name: 'LED-Lab-Brief.pdf',
                    mime_type: 'application/pdf',
                    size_bytes: 4096,
                    status: 'ready',
                    created_at: new Date().toISOString()
                  }
                ],
                recovery: false,
              },
            };
          }
          if (message.action === 'analyses.list') {
            return {
              ok: true,
              data: [
                {
                  id: 'analysis-tut-1',
                  assignment_id: 'assign-guide-1',
                  artifact_kind: 'tutorial',
                  title: 'LED Series Circuit Assembly',
                  created_at: new Date().toISOString()
                }
              ]
            };
          }
          if (message.action === 'analyses.get') {
            return {
              ok: true,
              data: {
                id: 'analysis-tut-1',
                title: 'LED Series Circuit Assembly',
                artifact_kind: 'tutorial',
                payload: {
                  status: 'tutorial',
                  title: 'LED Series Circuit Assembly',
                  objective: 'Wire a safe LED circuit with a current-limiting resistor in Tinkercad.',
                  components: [
                    { name: 'Red 5mm LED', quantity: 1, notes: '2.0V forward drop, 20mA max' },
                    { name: '220 Ω Resistor', quantity: 1, notes: 'Red-Red-Brown' },
                    { name: 'Small Breadboard', quantity: 1, notes: 'Standard half-size' }
                  ],
                  steps: [
                    {
                      step: 1,
                      instruction: 'Place the red LED across breadboard rows 10 and 11.',
                      why: 'Breadboard rows are connected horizontally. Placing across two rows prevents shorting anode and cathode.',
                      check: 'Anode (longer bent lead) is in row 10 and cathode (flat edge) is in row 11.'
                    },
                    {
                      step: 2,
                      instruction: 'Insert one lead of the 220 Ω resistor into row 11 and the other into the blue negative ground rail.',
                      why: 'Puts the resistor in series with the LED to limit current below 20mA ($I = \\\\frac{V_s - V_f}{R}$).',
                      check: 'Resistor bridges row 11 to the GND rail with no loose leads.'
                    }
                  ]
                }
              }
            };
          }
          if (message.action === 'progress.get') {
            return { ok: true, data: globalThis.savedProgress };
          }
          if (message.action === 'progress.save') {
            globalThis.savedProgress = {
              current_step: message.payload?.currentStep ?? 0,
              completed: message.payload?.completed ?? []
            };
            return { ok: true, data: globalThis.savedProgress };
          }
          if (message.action === 'ai.chat') {
            globalThis.chatRequests.push(message.payload);
            return {
              ok: true,
              data: {
                result: {
                  answer: 'Here is step clarification.'
                }
              }
            };
          }
        }
        return nativeSend(message, ...rest);
      };
    `);

    // Notify extension that account state has updated
    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.tinkercad.com/*' });
      await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { channel: 'ohmi', event: 'account.changed' })));
    });

    const dialog = companion.getByRole('dialog', { name: 'OHMI', exact: true });
    if (!await dialog.isVisible()) {
      await mascot.click();
    }
    await dialog.waitFor();

    // Navigate to Assignments
    const homeBtn = companion.getByRole('button', { name: 'Home', exact: true });
    if (await homeBtn.getAttribute('aria-current') !== 'page') {
      await homeBtn.click({ force: true });
    }
    const assignmentShortcut = companion.getByRole('button', { name: /Assignments/i }).first();
    await assignmentShortcut.click();

    // Verify assignment is rendered and click "Tutorial guide"
    await companion.getByText('LED-Lab-Brief.pdf').waitFor();
    const tutorialGuideBtn = companion.getByRole('button', { name: 'Tutorial guide', exact: true });
    await tutorialGuideBtn.click();

    // Verify Guide view loaded active tutorial
    await companion.getByRole('heading', { name: 'LED Series Circuit Assembly', exact: true }).waitFor();
    assert.equal(await companion.getByText(/Wire a safe LED circuit/i).isVisible(), true, 'Objective rendered');

    // Test interactive component checklist
    assert.equal(await companion.getByText('0/3 confirmed').isVisible(), true, 'Initial component confirmation counter');
    const firstCompCheckbox = companion.locator('.ohmi-parts-list input[type="checkbox"]').first();
    await firstCompCheckbox.check();
    assert.equal(await companion.getByText('1/3 confirmed').isVisible(), true, 'Counter updates when checkbox checked');

    // Verify Step 1 instruction and Why rendered with MessageContent
    assert.equal(await companion.getByText('Place the red LED across breadboard rows 10 and 11.').isVisible(), true, 'Step 1 instruction rendered');
    assert.equal(await companion.getByText(/prevents shorting anode and cathode/i).isVisible(), true, 'Step 1 why rendered');

    // Test "Explain this step" action: prefills draft in Ask and preserves Guide progress
    const explainBtn = companion.getByRole('button', { name: 'Explain this step', exact: true });
    await explainBtn.click();
    await companion.getByRole('heading', { name: 'Ask OHMI', exact: true }).waitFor();
    const questionBox = companion.getByRole('textbox', { name: 'Your demo question' }).or(companion.locator('#ohmi-question'));
    const draftValue = await questionBox.inputValue();
    assert.ok(draftValue.includes('Step 1'), 'Explain draft contains step 1 reference');
    assert.ok(draftValue.includes('Place the red LED'), 'Explain draft contains instruction');

    // Return to Guide section: Step 1 and checked component remain intact!
    await companion.getByRole('button', { name: 'Guide section', exact: true }).click();
    await companion.getByRole('heading', { name: 'LED Series Circuit Assembly', exact: true }).waitFor();
    assert.equal(await companion.getByText('1/3 confirmed').isVisible(), true, 'Component checklist state preserved across Ask navigation');
    assert.equal(await companion.getByText('Step 1 of 2').isVisible(), true, 'Step 1 still active');

    // Mark Step 1 done -> progress saved
    const markStepDoneBtn = companion.getByRole('button', { name: 'Mark step done', exact: true });
    await markStepDoneBtn.click();
    await guidePage.waitForTimeout(100);
    const currentSaved = await inWorld('globalThis.savedProgress');
    assert.deepEqual(currentSaved.completed, [0], 'progress.save called with completed step');

    // Next step -> Step 2
    await companion.getByRole('button', { name: 'Next step', exact: true }).click();
    assert.equal(await companion.getByText('Step 2 of 2').isVisible(), true, 'Step 2 active');

    // Test "It didn't work" action: prefills troubleshooting prompt
    const itDidntWorkBtn = companion.getByRole('button', { name: "It didn't work", exact: true });
    await itDidntWorkBtn.click();
    await companion.getByRole('heading', { name: 'Ask OHMI', exact: true }).waitFor();
    const troubleshootDraft = await questionBox.inputValue();
    assert.ok(troubleshootDraft.includes("didn't work"), 'Draft includes troubleshooting text');
    assert.ok(troubleshootDraft.includes('Step 2'), 'Draft includes step 2 reference');

    // Return to Guide section and test context-aware back button
    await companion.getByRole('button', { name: 'Guide section', exact: true }).click();
    const backBtn = companion.getByRole('button', { name: 'Back to assignments', exact: true });
    await backBtn.click();
    await companion.getByRole('heading', { name: 'Your assignments', exact: true }).waitFor();

    console.log('PASS Beginner Guide: grounded context, interactive component checklist, step guidance, "Explain this step" & "It didn\'t work" continuity, and progress persistence.');
  } finally {
    await guidePage.close();
  }
}

export async function testConversationPagingAndWatermark(context) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  const pagingPage = await context.newPage();
  const cdp = await context.newCDPSession(pagingPage);
  try {
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');

    await pagingPage.goto('https://www.tinkercad.com/things/ohmi-test/editel');
    await pagingPage.waitForLoadState('networkidle');
    const companion = pagingPage.locator('ohmi-companion');
    const mascot = companion.locator('.ohmi-mascot');
    await mascot.waitFor();

    const isolated = worlds.find(world => world.origin === `chrome-extension://${extensionId}` && !world.auxData?.isDefault);
    assert.ok(isolated, 'Use the actual content-script context');

    const inWorld = async expression => {
      const result = await cdp.send('Runtime.evaluate', { contextId: isolated.id, expression, awaitPromise: true, returnByValue: true });
      assert.equal(result.exceptionDetails, undefined);
      return result.result.value;
    };

    await inWorld(`
      globalThis.chatRequests = [];
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => {
        if (message?.channel === 'ohmi') {
          if (message.action === 'account.state') {
            return {
              ok: true,
              data: {
                configured: true,
                user: { id: 'paging-user-1', email: 'paging.student@example.test' },
                profile: { id: 'paging-user-1', display_name: 'Paging Student', language: 'english' },
                assignments: [],
                recovery: false,
              },
            };
          }
          if (message.action === 'conversations.list') {
            return {
              ok: true,
              data: [
                { id: 'conv-large-1', title: '50+ Messages Discussion', analysis_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
                { id: 'conv-other-2', title: 'Second Thread', analysis_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
              ]
            };
          }
          if (message.action === 'conversations.open') {
            if (message.payload?.beforePosition === 51) {
              return {
                ok: true,
                data: {
                  conversation: { id: 'conv-large-1', title: '50+ Messages Discussion' },
                  messages: [
                    { id: 'msg-45', role: 'user', content: 'Turn 45: What about resistor power?', position: 45 },
                    { id: 'msg-46', role: 'assistant', content: 'Turn 46: Check power with P = I^2 * R.', position: 46 }
                  ],
                  hasOlder: false,
                  earliestPosition: 45,
                  latestPosition: 46
                }
              };
            }
            return {
              ok: true,
              data: {
                conversation: { id: 'conv-large-1', title: '50+ Messages Discussion' },
                messages: [
                  { id: 'msg-51', role: 'user', content: 'Turn 51: And what about LED current?', position: 51 },
                  { id: 'msg-52', role: 'assistant', content: 'Turn 52: Use 20mA as a typical target.', position: 52 }
                ],
                hasOlder: true,
                earliestPosition: 51,
                latestPosition: 52
              }
            };
          }
          if (message.action === 'ai.chat') {
            globalThis.chatRequests.push(message.payload);
            return {
              ok: true,
              data: {
                historyWatermark: (message.payload.historyThroughPosition || 0) + 2,
                result: {
                  answer: 'Watermarked reply: Keep LED current below 20mA.'
                }
              }
            };
          }
        }
        return nativeSend(message, ...rest);
      };
    `);

    await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.tinkercad.com/*' });
      await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { channel: 'ohmi', event: 'account.changed' })));
    });

    const dialog = companion.getByRole('dialog', { name: 'OHMI', exact: true });
    if (!await dialog.isVisible()) {
      await mascot.click();
    }
    await dialog.waitFor();

    await companion.getByRole('button', { name: 'Ask section', exact: true }).click();
    await companion.getByRole('heading', { name: 'Ask OHMI', exact: true }).waitFor();

    const historyBtn = companion.getByRole('button', { name: 'History', exact: true });
    await historyBtn.click();
    await companion.getByText('Past conversations').waitFor();

    await companion.getByRole('button', { name: '50+ Messages Discussion', exact: true }).click();
    await companion.getByText('Turn 51: And what about LED current?').waitFor();

    assert.equal(await companion.getByText('Turn 51: And what about LED current?').isVisible(), true, 'Newest user turn rendered');
    assert.equal(await companion.getByText('Turn 52: Use 20mA as a typical target.').isVisible(), true, 'Newest assistant turn rendered');

    const loadOlderBtn = companion.getByRole('button', { name: 'Load older messages', exact: true });
    assert.equal(await loadOlderBtn.isVisible(), true, 'Load older messages button visible');

    await loadOlderBtn.click();
    await companion.getByText('Turn 45: What about resistor power?').waitFor();
    assert.equal(await companion.getByText('Turn 46: Check power with P = I^2 * R.').isVisible(), true, 'Older assistant reply loaded');

    const questionBox = companion.locator('#ohmi-question');
    await questionBox.fill('Can I use a 330 ohm resistor?');
    await companion.getByRole('button', { name: 'Send', exact: true }).click();
    await companion.getByText('Watermarked reply: Keep LED current below 20mA.').waitFor();

    const lastChatReq = await inWorld('globalThis.chatRequests[globalThis.chatRequests.length - 1]');
    assert.equal(lastChatReq.conversationId, 'conv-large-1', 'Correct conversation ID sent');
    assert.equal(lastChatReq.historyThroughPosition, 52, 'Watermark was frozen at send time');

    console.log('PASS Conversation paging & memory: keyset paging, load older messages, history watermark, and stale response isolation.');
  } finally {
    await pagingPage.close();
  }
}
