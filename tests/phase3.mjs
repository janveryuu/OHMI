import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function testPhase3(context, page, screenshots) {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).hostname;
  const account = await context.newPage();
  await account.goto(`chrome-extension://${id}/account.html`);
  await account.getByRole('heading', { name: 'Your OHMI account', exact: true }).waitFor();
  await account.getByLabel('Email', { exact: true }).fill('student@example.com');
  assert.equal(await account.getByLabel('Password', { exact: true }).getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.locator('ohmi-companion input[type="password"]').count(), 0, 'Credentials never appear in Tinkercad DOM');
  await account.screenshot({ path: join(screenshots, 'phase-3-account.png'), fullPage: true });
  await account.setViewportSize({ width: 320, height: 600 });
  assert.equal(await account.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Account fits small screens');
  await account.screenshot({ path: join(screenshots, 'phase-3-account-small.png'), fullPage: true });
  await account.getByText('Continue with Google. Email registration and password recovery are not available yet.', { exact: true }).waitFor();
  for (const name of ['Create account', 'Forgot password?', 'Enter confirmation code']) {
    assert.equal(await account.getByRole('button', { name, exact: true }).isDisabled(), true, `${name} is gated until email delivery works`);
  }
  assert.equal(await account.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled(), true);
  assert.equal(await account.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true);
  await account.close();
  console.log('PASS Phase 3 account UI: trusted page, password manager labels, no credentials in host DOM, small layout, email workflows gated, Google and existing-account sign-in available.');
}
