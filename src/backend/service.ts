import { browser } from 'wxt/browser';
import { createBackendClient, authStorage, AUTH_STORAGE_KEY } from './client';
import { readPreferences } from '../preview';
import { validateCallback, validateFile, type Request } from './validation';
import type { AccountState, Assignment, AssignmentStep, Profile } from './contracts';

const bucket = 'ohmi-assignments';
const assignmentColumns = 'id,original_name,mime_type,size_bytes,status,created_at';
const stepColumns = 'id,assignment_id,title,completed,created_at';
const signedOut: AccountState = { configured: true, user: null, profile: null, assignments: [], recovery: false };
let backend: ReturnType<typeof createBackendClient> | undefined;
let authBusy = false;
const fail = (error: { message: string } | null) => { if (error) throw error; };

export async function initializeBackend() {
  await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  try { backend = createBackendClient(); } catch { return; }
  backend.client.auth.onAuthStateChange(() => { setTimeout(() => { void notifyAccount(); }, 0); });
}

async function notifyAccount() {
  await browser.runtime.sendMessage({ channel: 'ohmi', event: 'account.changed' }).catch(() => undefined);
  const tabs = await browser.tabs.query({ url: 'https://www.tinkercad.com/*' }).catch(() => []);
  await Promise.all(tabs.map((tab) => tab.id === undefined ? undefined : browser.tabs.sendMessage(tab.id, { channel: 'ohmi', event: 'account.changed' }).catch(() => undefined)));
}

async function currentUser() {
  if (!backend) throw new Error('Supabase is not configured. Ask the project owner to configure OHMI.');
  const session = await backend.client.auth.getSession();
  if (!session.data.session) return null;
  fail(session.error);
  const result = await backend.client.auth.getUser();
  if (result.error && [400, 401, 403].includes(result.error.status ?? 0)) {
    await backend.client.auth.signOut({ scope: 'local' });
    await browser.storage.session.remove('ohmi-recovery');
    return null;
  }
  fail(result.error);
  return result.data.user;
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error('Sign in to access your private assignments.');
  return user;
}

async function state(): Promise<AccountState> {
  if (!backend) return { ...signedOut, configured: false };
  const user = await currentUser();
  if (!user) return signedOut;
  const client = backend.client;
  const created = await client.from('ohmi_profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
  if (created.error) return { ...signedOut, user: { id: user.id, email: user.email ?? '' }, storageError: publicError(created.error), recovery: (await browser.storage.session.get('ohmi-recovery'))['ohmi-recovery'] === user.id };
  const [profile, assignments, recovery] = await Promise.all([
    client.from('ohmi_profiles').select('id,display_name,language').eq('id', user.id).single(),
    client.from('ohmi_assignments').select(assignmentColumns).eq('user_id', user.id).order('created_at', { ascending: false }),
    browser.storage.session.get('ohmi-recovery'),
  ]);
  if (profile.error || assignments.error) return { ...signedOut, user: { id: user.id, email: user.email ?? '' }, storageError: publicError(profile.error || assignments.error), recovery: recovery['ohmi-recovery'] === user.id };
  return { configured: true, user: { id: user.id, email: user.email ?? '' }, profile: profile.data as Profile, assignments: assignments.data as Assignment[], recovery: recovery['ohmi-recovery'] === user.id };
}

function callback() {
  const expectedId = import.meta.env.WXT_EXTENSION_ID;
  const configured = import.meta.env.WXT_EXTENSION_CALLBACK;
  if (browser.runtime.id !== expectedId) throw new Error('Extension ID does not match the registered OHMI callback. Reload OHMI from its original build folder.');
  const url = new URL(configured || browser.identity.getRedirectURL());
  if (url.protocol !== 'https:' || url.hostname !== `${browser.runtime.id}.chromiumapp.org` || url.search || url.hash) throw new Error('Configure the exact registered Chrome callback URL.');
  return url.href;
}

async function authenticate(request: Request) {
  if (!backend) throw new Error('Supabase is not configured.');
  if (['auth.signUp', 'auth.resend', 'auth.forgot', 'auth.confirm', 'auth.recover', 'auth.password'].includes(request.action) && import.meta.env.WXT_EMAIL_DELIVERY_READY !== 'true') throw new Error('Email confirmation and password reset are pending email delivery setup. Use Google sign-in for now.');
  if (authBusy) throw new Error('Finish or close the current sign-in window before trying again.');
  authBusy = true;
  const { action, payload } = request;
  const client = backend.client;
  try {
    const email = String(payload.email ?? '');
    const password = String(payload.password ?? '');
    if (action === 'auth.signIn') fail((await client.auth.signInWithPassword({ email, password })).error);
    else if (action === 'auth.signUp') {
      fail((await client.auth.signUp({ email, password, options: { emailRedirectTo: callback() } })).error);
      return { message: 'If signup is available for this address, check your email for a confirmation code.' };
    } else if (action === 'auth.resend') {
      fail((await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: callback() } })).error);
      return { message: 'If confirmation is needed, a new code has been sent.' };
    } else if (action === 'auth.confirm') fail((await client.auth.verifyOtp({ email, token: String(payload.token), type: 'email' })).error);
    else if (action === 'auth.forgot') {
      fail((await client.auth.resetPasswordForEmail(email, { redirectTo: callback() })).error);
      return { message: 'If an account exists, check your email for a recovery code.' };
    } else if (action === 'auth.recover') {
      const result = await client.auth.verifyOtp({ email, token: String(payload.token), type: 'recovery' });
      fail(result.error);
      if (!result.data.user) throw new Error('Recovery did not establish a session. Request another code.');
      await browser.storage.session.set({ 'ohmi-recovery': result.data.user.id });
    } else if (action === 'auth.password') {
      const user = await requireUser();
      if ((await browser.storage.session.get('ohmi-recovery'))['ohmi-recovery'] !== user.id) throw new Error('Verify your recovery code before changing the password.');
      fail((await client.auth.updateUser({ password })).error);
      await browser.storage.session.remove('ohmi-recovery');
    } else if (action === 'auth.signOut') {
      fail((await client.auth.signOut({ scope: 'local' })).error);
      await browser.storage.session.remove('ohmi-recovery');
    } else if (action === 'auth.google') {
      const redirectTo = callback();
      const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      fail(result.error);
      if (!result.data.url) throw new Error('Google sign-in is unavailable.');
      const returned = await browser.identity.launchWebAuthFlow({ url: result.data.url, interactive: true });
      if (!returned) throw new Error('Google sign-in was cancelled.');
      fail((await client.auth.exchangeCodeForSession(validateCallback(returned, redirectTo))).error);
    }
    return await state();
  } finally {
    try { if (action === 'auth.google') await authStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`); }
    finally { authBusy = false; void notifyAccount(); }
  }
}

export async function handleRequest(request: Request): Promise<unknown> {
  const { action, payload } = request;
  if (action === 'local.read') {
    const stored = await browser.storage.local.get(['ohmi', 'ohmiPreferences']);
    const value = stored.ohmi as { open?: unknown; position?: { x?: unknown; y?: unknown } } | undefined;
    const valid = value && typeof value.open === 'boolean' && Number.isFinite(value.position?.x) && Number.isFinite(value.position?.y);
    return { ohmi: valid ? { position: { x: value!.position!.x, y: value!.position!.y }, open: value!.open } : undefined, ohmiPreferences: readPreferences(stored.ohmiPreferences) };
  }
  if (action === 'local.position') {
    await browser.storage.local.set({ ohmi: { position: payload.position, open: payload.open } }); return null;
  }
  if (action === 'local.preferences') { await browser.storage.local.set({ ohmiPreferences: readPreferences(payload) }); return null; }
  if (action === 'account.open') { await browser.tabs.create({ url: browser.runtime.getURL('/account.html') + (payload.view === 'upload' ? '#upload' : '') }); return null; }
  if (action === 'account.state') return state();
  if (action.startsWith('auth.')) return authenticate(request);
  const user = await requireUser();
  // This is a stale-view guard, never an authority: ownership comes from verified Auth.
  if (authBusy || payload.accountId !== user.id) throw new Error('Account changed. Refresh your account before continuing.');
  const client = backend!.client;
  if (action === 'profile.language' || action === 'profile.name') {
    const update = action === 'profile.language' ? { language: String(payload.language) } : { display_name: String(payload.name).trim() };
    fail((await client.from('ohmi_profiles').update(update).eq('id', user.id)).error);
    void notifyAccount(); return state();
  }
  if (action === 'files.prepare') {
    const file = validateFile(payload);
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}/assignment.${file.extension}`;
    fail((await client.from('ohmi_assignments').insert({ id, user_id: user.id, original_name: file.name, object_path: path, mime_type: file.mime, size_bytes: file.size })).error);
    const session = await client.auth.getSession(); fail(session.error);
    if (!session.data.session || session.data.session.user.id !== user.id) throw new Error('Account changed. Sign in again before uploading.');
    return { id, url: `${backend!.config.url}/storage/v1/object/${bucket}/${path}`, key: backend!.config.key, token: session.data.session.access_token, mime: file.mime };
  }
  if (['files.finish', 'files.open', 'files.delete'].includes(action)) {
    const result = await client.from('ohmi_assignments').select('*').eq('id', String(payload.id)).eq('user_id', user.id).single(); fail(result.error);
    const assignment = result.data;
    if (!assignment) throw new Error('Assignment is no longer available. Refresh your files.');
    if (action === 'files.finish') {
      const stored = await client.storage.from(bucket).list(`${user.id}/${assignment.id}`); fail(stored.error);
      const file = stored.data?.find((item) => `${user.id}/${assignment.id}/${item.name}` === assignment.object_path);
      if (!file || Number(file.metadata?.size) !== assignment.size_bytes || file.metadata?.mimetype !== assignment.mime_type) throw new Error('Upload could not be verified. Delete this pending item and try again.');
      fail((await client.from('ohmi_assignments').update({ status: 'ready' }).eq('id', assignment.id).eq('user_id', user.id)).error);
    } else if (action === 'files.open') {
      if (assignment.status !== 'ready') throw new Error('This upload is incomplete. Delete it and try again.');
      const signed = await client.storage.from(bucket).createSignedUrl(assignment.object_path, 60); fail(signed.error);
      if (!signed.data) throw new Error('File could not be opened.');
      await browser.tabs.create({ url: signed.data.signedUrl });
    } else {
      fail((await client.storage.from(bucket).remove([assignment.object_path])).error);
      fail((await client.from('ohmi_assignments').delete().eq('id', assignment.id).eq('user_id', user.id)).error);
    }
    void notifyAccount(); return null;
  }
  if (action.startsWith('steps.')) {
    if (action === 'steps.list') {
      const result = await client.from('ohmi_assignment_steps').select(stepColumns).eq('assignment_id', String(payload.assignmentId)).eq('user_id', user.id).order('created_at'); fail(result.error); return result.data as AssignmentStep[];
    }
    let result;
    if (action === 'steps.add') result = await client.from('ohmi_assignment_steps').insert({ assignment_id: String(payload.assignmentId), user_id: user.id, title: String(payload.title) });
    else if (action === 'steps.update') result = await client.from('ohmi_assignment_steps').update({ completed: Boolean(payload.completed) }).eq('id', String(payload.id)).eq('user_id', user.id);
    else result = await client.from('ohmi_assignment_steps').delete().eq('id', String(payload.id)).eq('user_id', user.id);
    fail(result.error); void notifyAccount(); return null;
  }
  throw new Error('Unknown request.');
}

export function publicError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === 'invalid_credentials') return 'Email or password is incorrect.';
  if (value?.code === 'email_not_confirmed') return 'Confirm your email using the code before signing in.';
  if (value?.code === 'otp_expired') return 'That code expired or is invalid. Request another code.';
  if (value?.code === 'over_email_send_rate_limit') return 'Too many email requests. Wait a few minutes before retrying.';
  if (value?.code === 'PGRST205' || value?.code === '42P01') return 'Private storage setup is pending. Ask the project owner to apply the OHMI migration.';
  if (/fetch|network|timeout/i.test(value?.message ?? '')) return 'Connection failed. Check your internet and retry.';
  if (error instanceof Error && !('code' in error)) return error.message.slice(0, 220);
  return 'OHMI could not complete this action. Try again.';
}
