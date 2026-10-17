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

  console.log('PASS Assignment workspace: honest initial loading, no premature login form, scoped email notice, and seamless hydration.');
}
