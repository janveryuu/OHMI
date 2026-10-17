import assert from 'node:assert/strict';

export async function testAssignmentWorkspace(context) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;

  // 1. Test delayed synthetic account resolution: honest loading state
  const delayedPage = await context.newPage();
  try {
    await delayedPage.addInitScript(() => {
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => {
        if (message?.action === 'account.state') {
          // Delay by 400ms to allow inspection of the initial loading state
          await new Promise((resolve) => setTimeout(resolve, 400));
          return {
            ok: true,
            data: {
              configured: true,
              user: { id: 'google-user-1', email: 'google.student@example.test' },
              profile: { id: 'google-user-1', display_name: 'Google Student', language: 'english' },
              assignments: [],
              recovery: false,
            },
          };
        }
        return nativeSend(message, ...rest);
      };
    });

    await delayedPage.goto(`chrome-extension://${extensionId}/account.html`);

    // Verify initial unresolved loading view: neutral loading heading, no login form, no SMTP notice
    assert.equal(
      await delayedPage.getByRole('heading', { name: 'Loading your OHMI workspace…', exact: true }).isVisible(),
      true,
      'Initial loading heading displayed during hydration'
    );
    assert.equal(
      await delayedPage.getByText('Loading account…', { exact: true }).isVisible(),
      true,
      'Loading status indicator visible during hydration'
    );
    assert.equal(
      await delayedPage.getByRole('button', { name: 'Continue with Google', exact: true }).count(),
      0,
      'Google login button is not rendered during initial loading'
    );
    assert.equal(
      await delayedPage.getByLabel('Email', { exact: true }).count(),
      0,
      'Email login field is not rendered during initial loading'
    );
    assert.equal(
      await delayedPage.locator('.ohmi-notice').count(),
      0,
      'No SMTP warning rendered during initial loading'
    );

    // Now wait for delayed hydration to resolve to the authenticated workspace automatically
    await delayedPage.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();
    assert.equal(
      await delayedPage.getByText('google.student@example.test', { exact: true }).isVisible(),
      true,
      'Authenticated user email displayed once resolved'
    );
    assert.equal(
      await delayedPage.locator('.ohmi-notice').count(),
      0,
      'No SMTP warning in authenticated workspace'
    );
    assert.equal(
      await delayedPage.getByRole('button', { name: 'Reset password', exact: true }).count(),
      0,
      'Unavailable Reset password button is hidden when email delivery is disabled'
    );
    assert.equal(
      await delayedPage.getByRole('button', { name: 'Sign out', exact: true }).isEnabled(),
      true,
      'Sign out button is available'
    );
    assert.equal(
      await delayedPage.locator('#upload').isVisible(),
      true,
      'Upload section mounted once authenticated'
    );
  } finally {
    await delayedPage.close();
  }

  // 2. Test #upload hash intent for authenticated user and workspace focus
  const uploadIntentPage = await context.newPage();
  try {
    let assignments = [];
    await uploadIntentPage.addInitScript(() => {
      globalThis.__testAssignments = [];
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => {
        if (message?.action === 'account.state') {
          return {
            ok: true,
            data: {
              configured: true,
              user: { id: 'google-user-1', email: 'google.student@example.test' },
              profile: { id: 'google-user-1', display_name: 'Google Student', language: 'english' },
              assignments: globalThis.__testAssignments,
              recovery: false,
            },
          };
        }
        if (message?.action === 'profile.name') {
          return { ok: true, data: { message: 'Account name saved.' } };
        }
        if (message?.action === 'files.prepare') {
          return {
            ok: true,
            data: {
              id: 'asg-test-1',
              url: 'https://upload.supabase.co/storage/v1/object/ohmi-assignments/google-user-1/asg-test-1/brief.pdf',
              token: 'mock-upload-token',
              key: 'mock-anon-key',
              mime: 'application/pdf',
            },
          };
        }
        if (message?.action === 'files.open') {
          globalThis.__fileOpened = true;
          return { ok: true, data: 'https://upload.supabase.co/signed/sample.pdf' };
        }
        if (message?.action === 'files.finish') {
          globalThis.__testAssignments.push({
            id: message.payload?.id || 'asg-test-1',
            original_name: message.payload?.name || globalThis.__lastUploadedName || 'brief.pdf',
            size_bytes: 1024,
            mime_type: 'application/pdf',
            status: 'ready',
            created_at: new Date().toISOString(),
          });
          return { ok: true, data: { status: 'ready' } };
        }
        if (message?.action === 'files.delete') {
          globalThis.__testAssignments = globalThis.__testAssignments.filter((a) => a.id !== message.payload?.id);
          return { ok: true, data: null };
        }
        return nativeSend(message, ...rest);
      };

      // Mock XHR for file upload with delay and abort support
      const OriginalXHR = window.XMLHttpRequest;
      class MockXHR extends OriginalXHR {
        open(method, url) {
          this._url = url;
          super.open(method, url);
        }
        send(body) {
          if (this._url?.includes('upload.supabase.co')) {
            const isCancel = body?.name?.includes('cancel');
            const delay = isCancel ? 3000 : 40;
            this._timer1 = setTimeout(() => {
              if (this.upload.onprogress) {
                this.upload.onprogress({ lengthComputable: true, loaded: 512, total: 1024 });
              }
            }, delay / 2);
            this._timer2 = setTimeout(() => {
              if (this.upload.onprogress) {
                this.upload.onprogress({ lengthComputable: true, loaded: 1024, total: 1024 });
              }
              Object.defineProperty(this, 'status', { value: 200, writable: false });
              if (this.onload) this.onload();
            }, delay);
            return;
          }
          super.send(body);
        }
        abort() {
          clearTimeout(this._timer1);
          clearTimeout(this._timer2);
          if (this.onabort) this.onabort();
        }
      }
      window.XMLHttpRequest = MockXHR;
    });

    // Verify #upload intent at narrow viewport
    await uploadIntentPage.setViewportSize({ width: 320, height: 600 });
    await uploadIntentPage.goto(`chrome-extension://${extensionId}/account.html#upload`);
    await uploadIntentPage.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();

    const focusedIdNarrow = await uploadIntentPage.evaluate(() => document.activeElement?.id);
    assert.equal(focusedIdNarrow, 'ohmi-assignment-file', 'Assignment file input is focused after #upload navigation on narrow viewport');

    // Switch to desktop viewport
    await uploadIntentPage.setViewportSize({ width: 1280, height: 800 });

    // Verify overlay helper text is omitted in account.html where onUpload is provided
    assert.equal(
      await uploadIntentPage.getByText('Upload opens your private OHMI workspace.', { exact: false }).count(),
      0,
      'Overlay helper text is omitted in account.html where onUpload is provided'
    );

    // Verify Save button is disabled when no file is chosen
    const saveButton = uploadIntentPage.getByRole('button', { name: 'Save private assignment', exact: true });
    assert.equal(await saveButton.isDisabled(), true, 'Save is disabled with no file chosen');

    // Trigger profile edit and save: verify focus is NOT stolen back to file input
    await uploadIntentPage.getByLabel('Display name', { exact: true }).fill('Updated Student');
    await uploadIntentPage.getByRole('button', { name: 'Save account name', exact: true }).click();
    await uploadIntentPage.getByText('Account name saved.', { exact: true }).waitFor();
    const activeAfterProfile = await uploadIntentPage.evaluate(() => document.activeElement?.id);
    assert.notEqual(activeAfterProfile, 'ohmi-assignment-file', 'Focus is not stolen back to file input after profile edit');

    // Click secondary "Upload assignment" button in PrivateAssignments: verify it focuses file input
    await uploadIntentPage.getByRole('button', { name: 'Upload assignment', exact: true }).click();
    const activeAfterSecondary = await uploadIntentPage.evaluate(() => document.activeElement?.id);
    assert.equal(activeAfterSecondary, 'ohmi-assignment-file', 'Secondary upload button reuses scroll/focus handler');

    // 3. Test validation edge cases
    // 3a. Mismatched signature: .pdf with corrupt bytes
    await uploadIntentPage.setInputFiles('#ohmi-assignment-file', {
      name: 'corrupt.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
    });
    assert.equal(await saveButton.isEnabled(), true);
    await saveButton.click();
    await uploadIntentPage.getByText('Choose a valid PDF, PNG, or JPG file with a matching file type.', { exact: true }).waitFor();

    // 3b. Oversized file (>10 MiB)
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    await uploadIntentPage.setInputFiles('#ohmi-assignment-file', {
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer,
    });
    await saveButton.click();
    await uploadIntentPage.getByText('Choose a file between 1 byte and 10 MiB.', { exact: true }).waitFor();

    // 3c. In-flight upload abort / cancellation
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC4, 0xE5, 0xF2, 0xE5, 0x0A, 0x00]);
    await uploadIntentPage.setInputFiles('#ohmi-assignment-file', {
      name: 'cancel-me.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(validPdfBytes),
    });
    await saveButton.click();
    const cancelBtn = uploadIntentPage.getByRole('button', { name: 'Cancel upload', exact: true });
    await cancelBtn.waitFor();
    await cancelBtn.click();
    await uploadIntentPage.getByText('Upload cancelled.', { exact: true }).waitFor();

    // 3d. Valid PDF upload end to end
    await uploadIntentPage.setInputFiles('#ohmi-assignment-file', {
      name: 'brief.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(validPdfBytes),
    });
    await saveButton.click();
    await uploadIntentPage.getByText('Assignment saved privately. No AI analysis was performed.', { exact: true }).waitFor();
    assert.equal(
      await uploadIntentPage.getByText('brief.pdf', { exact: true }).isVisible(),
      true,
      'Uploaded assignment appears in PrivateAssignments list'
    );

    // 3e. Test "Open file" action
    await uploadIntentPage.getByRole('button', { name: 'Open file', exact: true }).click();
    const fileOpened = await uploadIntentPage.evaluate(() => globalThis.__fileOpened);
    assert.equal(fileOpened, true, 'Clicking Open file triggers files.open');

    // 3f. Test delete: cancellation keeps assignment, confirm deletes it
    uploadIntentPage.on('dialog', async (dialog) => {
      assert.equal(dialog.type(), 'confirm');
      await dialog.dismiss();
    });
    await uploadIntentPage.getByRole('button', { name: 'Delete', exact: true }).click();
    assert.equal(
      await uploadIntentPage.getByText('brief.pdf', { exact: true }).isVisible(),
      true,
      'Dismissing delete confirmation preserves assignment'
    );

    uploadIntentPage.removeAllListeners('dialog');
    uploadIntentPage.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await uploadIntentPage.getByRole('button', { name: 'Delete', exact: true }).click();
    await uploadIntentPage.getByText('No saved assignments yet. Upload your first project brief.', { exact: true }).waitFor();
  } finally {
    await uploadIntentPage.close();
  }

  // 4. Test signed-out user with #upload intent resolves to focused uploader
  const signedOutIntentPage = await context.newPage();
  try {
    let authenticated = false;
    await signedOutIntentPage.addInitScript(() => {
      globalThis.__testAuthenticated = false;
      const nativeSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = async (message, ...rest) => {
        if (message?.action === 'account.state') {
          return {
            ok: true,
            data: {
              configured: true,
              user: globalThis.__testAuthenticated ? { id: 'google-user-2', email: 'signedout@example.test' } : null,
              profile: globalThis.__testAuthenticated ? { id: 'google-user-2', display_name: 'Resolved', language: 'english' } : null,
              assignments: [],
              recovery: false,
            },
          };
        }
        if (message?.action === 'auth.google') {
          globalThis.__testAuthenticated = true;
          return { ok: true, data: { user: { id: 'google-user-2', email: 'signedout@example.test' } } };
        }
        return nativeSend(message, ...rest);
      };
    });

    await signedOutIntentPage.goto(`chrome-extension://${extensionId}/account.html#upload`);
    await signedOutIntentPage.getByRole('heading', { name: 'Your OHMI account', exact: true }).waitFor();

    // Click Continue with Google
    await signedOutIntentPage.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await signedOutIntentPage.getByRole('heading', { name: 'Your private workspace', exact: true }).waitFor();

    // Once authenticated, upload intent should focus #ohmi-assignment-file
    const focusedAfterAuth = await signedOutIntentPage.evaluate(() => document.activeElement?.id);
    assert.equal(focusedAfterAuth, 'ohmi-assignment-file', 'File input focused once authentication resolves');
  } finally {
    await signedOutIntentPage.close();
  }

  console.log('PASS Assignment workspace: honest initial loading, upload intent, verified upload/delete, and isolation.');
}

export async function testExpandableChat(context, screenshots) {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('https://www.tinkercad.com/things/expandable-chat-test/editel');
    await page.locator('.ohmi-mascot').waitFor();

    const mascot = page.locator('.ohmi-mascot');
    const panel = page.locator('#ohmi-panel');

    // Open assistant panel if closed
    if ((await mascot.getAttribute('aria-expanded')) !== 'true') {
      await mascot.click();
    }
    await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor();

    // Navigate to Ask section
    await page.getByRole('button', { name: 'Ask section', exact: true }).click();
    await page.getByRole('heading', { name: 'Ask OHMI', exact: true }).waitFor();

    // 1. Verify Expand chat button attributes
    const expandBtn = page.getByRole('button', { name: 'Expand chat', exact: true });
    assert.equal(await expandBtn.isVisible(), true, 'Expand chat button is visible in Ask header');
    assert.equal(await expandBtn.getAttribute('aria-expanded'), 'false', 'aria-expanded is false initially');
    assert.equal(await expandBtn.getAttribute('aria-controls'), 'ohmi-panel', 'aria-controls is ohmi-panel');

    // Enter draft text
    const question = page.getByLabel('Your demo question', { exact: true });
    await question.fill('Multiline draft line 1\nMultiline draft line 2');

    // Measure compact bounding box
    const compactBox = await panel.boundingBox();
    assert.ok(compactBox.width <= 360, `Compact panel width <= 360 (was ${compactBox.width})`);

    // 2. Expand chat
    await expandBtn.click();
    await page.waitForTimeout(300); // 240ms FLIP animation

    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), true, 'Panel has expanded class');
    const restoreBtn = page.getByRole('button', { name: 'Restore chat size', exact: true });
    assert.equal(await restoreBtn.isVisible(), true, 'Restore button is visible when expanded');
    assert.equal(await restoreBtn.getAttribute('aria-expanded'), 'true', 'aria-expanded is true when expanded');

    const expandedBox = await panel.boundingBox();
    assert.ok(expandedBox.width > compactBox.width, `Expanded width (${expandedBox.width}) > compact (${compactBox.width})`);
    assert.ok(expandedBox.height >= compactBox.height, `Expanded height (${expandedBox.height}) >= compact (${compactBox.height})`);

    // Draft preserved across toggle
    assert.equal(await question.inputValue(), 'Multiline draft line 1\nMultiline draft line 2', 'Draft text preserved in expanded chat');

    if (screenshots) {
      await page.screenshot({ path: `${screenshots}/chat-expanded-1280x800.png` });
    }

    // 3. Test Escape key order: expanded chat restores to compact on Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), false, 'Escape restores compact chat');
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-open')), true, 'Assistant remains open after Escape');
    assert.equal(await question.inputValue(), 'Multiline draft line 1\nMultiline draft line 2', 'Draft preserved after Escape restore');

    // 4. Test More menu Escape ordering
    await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'More sections', exact: true }).click();
    assert.equal(await page.locator('#ohmi-more').isVisible(), true, 'More menu opened');

    // First Escape closes More menu; chat remains expanded
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ohmi-more').count(), 0, 'First Escape closes More menu');
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), true, 'Chat remains expanded after closing More');

    // Second Escape restores compact chat
    await page.keyboard.press('Escape');
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), false, 'Second Escape restores compact chat');

    // Third Escape minimizes panel
    await page.keyboard.press('Escape');
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-open')), false, 'Third Escape minimizes assistant');

    // Reopen assistant
    await mascot.click();
    await page.getByRole('dialog', { name: 'OHMI', exact: true }).waitFor();
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), false, 'Reopened in compact mode');
    assert.equal(await question.inputValue(), 'Multiline draft line 1\nMultiline draft line 2', 'Draft preserved across minimize/reopen');

    // 5. Test section navigation restores compact
    await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), true);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    assert.equal(await panel.evaluate((el) => el.classList.contains('ohmi-panel-expanded')), false, 'Navigating away from Ask restores compact');

    await page.getByRole('button', { name: 'Ask section', exact: true }).click();
    assert.equal(await question.inputValue(), 'Multiline draft line 1\nMultiline draft line 2', 'Draft preserved navigating away and back');

    // 6. Test send demo & scroll continuity
    await page.getByRole('button', { name: 'Use sample attachment', exact: true }).click();
    await page.getByRole('button', { name: 'Send demo', exact: true }).click();
    await page.locator('.ohmi-message-ohmi').waitFor();

    // Verify message has data-message-id
    const messageIdCount = await page.locator('.ohmi-message[data-message-id]').count();
    assert.ok(messageIdCount > 0, 'Messages have data-message-id attribute');

    // Expand and restore with messages
    await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.ohmi-message').count(), 2, 'Messages preserved when expanded');
    await page.getByRole('button', { name: 'Restore chat size', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.ohmi-message').count(), 2, 'Messages preserved when restored');

    // 7. Verify narrow viewport (e.g. 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Expand chat', exact: true }).click();
    await page.waitForTimeout(300);
    const narrowExpandedBox = await panel.boundingBox();
    assert.ok(narrowExpandedBox.width <= 390, 'Expanded chat fits narrow width');
    assert.ok(narrowExpandedBox.x >= 12, '12px margin on narrow width');

    console.log('PASS Expandable Ask: one panel, two sizes, Escape hierarchy, draft & message continuity, and narrow-window responsiveness.');
  } finally {
    await page.close();
  }
}
