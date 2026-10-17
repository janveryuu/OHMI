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
        if (message?.action === 'files.finish') {
          globalThis.__testAssignments.push({
            id: 'asg-test-1',
            original_name: 'brief.pdf',
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

      // Mock XHR for file upload
      const OriginalXHR = window.XMLHttpRequest;
      class MockXHR extends OriginalXHR {
        open(method, url) {
          this._url = url;
          super.open(method, url);
        }
        send(body) {
          if (this._url?.includes('upload.supabase.co')) {
            setTimeout(() => {
              if (this.upload.onprogress) {
                this.upload.onprogress({ lengthComputable: true, loaded: 512, total: 1024 });
              }
            }, 20);
            setTimeout(() => {
              if (this.upload.onprogress) {
                this.upload.onprogress({ lengthComputable: true, loaded: 1024, total: 1024 });
              }
              Object.defineProperty(this, 'status', { value: 200, writable: false });
              if (this.onload) this.onload();
            }, 60);
            return;
          }
          super.send(body);
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

    // 3. Test synthetic upload end to end
    // PDF file header signature %PDF-1.4: 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC4, 0xE5, 0xF2, 0xE5, 0x0A, 0x00]);
    await uploadIntentPage.setInputFiles('#ohmi-assignment-file', {
      name: 'brief.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfBytes),
    });

    assert.equal(await saveButton.isEnabled(), true, 'Save is enabled after valid file chosen');
    await saveButton.click();

    // Verify upload progress and notice
    await uploadIntentPage.getByText('Assignment saved privately. No AI analysis was performed.', { exact: true }).waitFor();
    assert.equal(
      await uploadIntentPage.getByText('brief.pdf', { exact: true }).isVisible(),
      true,
      'Uploaded assignment appears in PrivateAssignments list'
    );

    // Test delete: prompt cancellation retains assignment
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

    // Now accept delete
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
