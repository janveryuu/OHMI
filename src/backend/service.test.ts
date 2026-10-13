import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const session = { user: { id: 'owner', email: 'owner@example.test' }, access_token: 'test-session' };
  const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn(), delete: vi.fn(), update: vi.fn(), upsert: vi.fn(), order: vi.fn() };
  const auth = { onAuthStateChange: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn(), signOut: vi.fn(), signUp: vi.fn() };
  return { session, query, auth, remove: vi.fn(), list: vi.fn(), launch: vi.fn(), removeItem: vi.fn(), get: vi.fn(), setAccessLevel: vi.fn() };
});
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { id: 'ikemolangalcofljjajakagdnfdpnakh', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: { local: { setAccessLevel: mock.setAccessLevel }, session: { setAccessLevel: mock.setAccessLevel, get: mock.get, remove: vi.fn() } },
  identity: { launchWebAuthFlow: mock.launch }, tabs: { query: vi.fn().mockResolvedValue([]) },
} }));
vi.mock('./client', () => ({ AUTH_STORAGE_KEY: 'ohmi-auth', authStorage: { removeItem: mock.removeItem }, createBackendClient: () => ({ client: { auth: mock.auth, from: () => mock.query, storage: { from: () => ({ remove: mock.remove, list: mock.list }) } }, config: { url: 'https://test.supabase.co', key: 'sb_publishable_test' } }) }));

describe('worker failure handling', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    vi.stubEnv('WXT_EMAIL_DELIVERY_READY', 'false');
    vi.stubEnv('WXT_EXTENSION_ID', 'ikemolangalcofljjajakagdnfdpnakh');
    vi.stubEnv('WXT_EXTENSION_CALLBACK', 'https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/');
    mock.auth.getSession.mockResolvedValue({ data: { session: mock.session }, error: null });
    mock.auth.getUser.mockResolvedValue({ data: { user: mock.session.user }, error: null });
    mock.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://test.supabase.co/auth/v1/authorize' }, error: null });
    mock.auth.signOut.mockResolvedValue({ error: null });
    mock.removeItem.mockResolvedValue(undefined); mock.get.mockResolvedValue({});
    mock.query.eq.mockReturnValue(mock.query); mock.query.select.mockReturnValue(mock.query);
    mock.query.single.mockResolvedValue({ data: { id: 'file', object_path: 'owner/file/assignment.pdf', size_bytes: 12, mime_type: 'application/pdf', status: 'pending' }, error: null });
    mock.query.delete.mockReturnValue(mock.query); mock.query.update.mockReturnValue(mock.query);
    mock.remove.mockResolvedValue({ error: null });
  });
  const service = async () => { const module = await import('./service'); await module.initializeBackend(); return module; };
  it('rejects stale account input before creating or editing owner data', async () => {
    const { handleRequest } = await service();
    for (const action of ['profile.name', 'profile.language', 'files.prepare'] as const) {
      await expect(handleRequest({ action, payload: { accountId: 'previous-owner', name: 'Old name', language: 'taglish', nameForFile: 'old.pdf' } })).rejects.toThrow('Account changed');
    }
    expect(mock.query.update).not.toHaveBeenCalled();
    expect(mock.query.single).not.toHaveBeenCalled();
  });
  it('blocks email delivery actions until SMTP is configured', async () => {
    const { handleRequest } = await service();
    for (const action of ['auth.signUp', 'auth.confirm', 'auth.resend', 'auth.forgot', 'auth.recover', 'auth.password'] as const) await expect(handleRequest({ action, payload: {} })).rejects.toThrow('pending email delivery');
    expect(mock.auth.signUp).not.toHaveBeenCalled();
  });
  it('keeps metadata when object deletion fails', async () => {
    const { handleRequest } = await service();
    mock.remove.mockResolvedValue({ error: new Error('storage unavailable') });
    await expect(handleRequest({ action: 'files.delete', payload: { id: 'file', accountId: 'owner' } })).rejects.toThrow('storage unavailable');
    expect(mock.query.delete).not.toHaveBeenCalled();
  });
  it('does not mark missing or mismatched uploads ready', async () => {
    const { handleRequest } = await service();
    for (const data of [[], [{ name: 'assignment.pdf', metadata: { size: 10, mimetype: 'application/pdf' } }]]) {
      mock.list.mockResolvedValue({ data, error: null });
      await expect(handleRequest({ action: 'files.finish', payload: { id: 'file', accountId: 'owner' } })).rejects.toThrow('Upload could not be verified');
    }
    expect(mock.query.update).not.toHaveBeenCalled();
  });
  it('rejects concurrent Google flows and clears verifier after cancellation', async () => {
    const { handleRequest } = await service();
    let cancel!: () => void;
    mock.launch.mockImplementation(() => new Promise(resolve => { cancel = () => resolve(undefined); }));
    const first = handleRequest({ action: 'auth.google', payload: {} });
    await vi.waitFor(() => expect(mock.launch).toHaveBeenCalled());
    await expect(handleRequest({ action: 'auth.google', payload: {} })).rejects.toThrow('current sign-in window');
    cancel(); await expect(first).rejects.toThrow('cancelled');
    expect(mock.removeItem).toHaveBeenCalledWith('ohmi-auth-code-verifier');
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('releases the auth lock even if verifier cleanup fails', async () => {
    const { handleRequest } = await service();
    mock.launch.mockResolvedValue(undefined);
    mock.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(handleRequest({ action: 'auth.google', payload: {} })).rejects.toThrow();
    await expect(handleRequest({ action: 'auth.google', payload: {} })).rejects.toThrow('cancelled');
    expect(mock.launch).toHaveBeenCalledTimes(2);
  });
  it('exchanges only an exact callback code and cleans up failed exchanges', async () => {
    const { handleRequest } = await service();
    mock.launch.mockResolvedValueOnce('https://evil.example/?code=stolen');
    await expect(handleRequest({ action: 'auth.google', payload: {} })).rejects.toThrow('unexpected callback');
    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    mock.launch.mockResolvedValueOnce('https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/?code=valid-code');
    mock.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('exchange failed') });
    await expect(handleRequest({ action: 'auth.google', payload: {} })).rejects.toThrow('exchange failed');
    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-code');
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://ikemolangalcofljjajakagdnfdpnakh.chromiumapp.org/', skipBrowserRedirect: true } });
    expect(mock.removeItem).toHaveBeenCalledTimes(2);
  });
});
