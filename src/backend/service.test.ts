import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const session = { user: { id: 'owner', email: 'owner@example.test' }, access_token: 'test-session' };
  const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), delete: vi.fn(), update: vi.fn(), upsert: vi.fn(), order: vi.fn(), insert: vi.fn() };
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
    vi.resetModules(); vi.clearAllMocks(); vi.unstubAllGlobals();
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
    mock.query.delete.mockReturnValue(mock.query); mock.query.update.mockReturnValue(mock.query); mock.query.insert.mockReturnValue(mock.query);
    mock.query.maybeSingle.mockResolvedValue({ data: null, error: null });
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
  it('explains unconfirmed-account login without directing users into unavailable email delivery', async () => {
    const { publicError } = await service();
    expect(publicError({ code: 'email_not_confirmed' })).toContain('pending email delivery setup');
    vi.stubEnv('WXT_EMAIL_DELIVERY_READY', 'true');
    expect(publicError({ code: 'email_not_confirmed' })).toBe('Confirm your email using the code before signing in.');
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
  it('forwards ai.chat with bearer token and active account verification', async () => {
    const { handleRequest } = await service();
    const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      requestId: 'req-1',
      result: { status: 'answer', answer: 'A resistor limits current.' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fakeFetch);

    const res = await handleRequest({
      action: 'ai.chat',
      payload: {
        accountId: 'owner',
        requestId: 'req-1',
        message: 'What does a resistor do?',
        language: 'english'
      }
    });

    expect(res).toEqual({
      ok: true,
      requestId: 'req-1',
      result: { status: 'answer', answer: 'A resistor limits current.' }
    });
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/ohmi-ai',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-session'
        })
      })
    );
  });

  it('creates owned conversations with bounded title', async () => {
    const { handleRequest } = await service();
    mock.query.single.mockResolvedValueOnce({
      data: { id: 'conv-123', title: 'Circuit Analysis Discussion', analysis_id: null, created_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z' },
      error: null
    });

    const res = await handleRequest({
      action: 'conversations.create',
      payload: { accountId: 'owner', title: 'Circuit Analysis Discussion' }
    });

    expect(res).toEqual({
      id: 'conv-123',
      title: 'Circuit Analysis Discussion',
      analysis_id: null,
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:00:00Z'
    });
  });

  it('forwards ai.circuit with bearer token and active account verification', async () => {
    const { handleRequest } = await service();
    const fakeFetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      requestId: 'req-circuit-1',
      result: {
        schemaVersion: 2,
        status: 'reviewed',
        summary: 'Circuit looks good.',
        findings: [],
        unknowns: [],
        questions: [],
        comparisons: [],
        steps: [],
        limitations: []
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fakeFetch);

    const res = await handleRequest({
      action: 'ai.circuit',
      payload: {
        accountId: 'owner',
        version: 2,
        operation: 'circuit_check',
        requestId: 'req-circuit-1',
        mode: 'check',
        board: 'uno-r3',
        language: 'english',
        message: 'Check this circuit',
        images: []
      }
    });

    expect(res).toEqual({
      ok: true,
      requestId: 'req-circuit-1',
      result: expect.objectContaining({ status: 'reviewed' })
    });
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/ohmi-ai',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-session'
        })
      })
    );
  });

  it('rejects stale account before ai.circuit request', async () => {
    const { handleRequest } = await service();
    await expect(handleRequest({
      action: 'ai.circuit',
      payload: { accountId: 'previous-owner', requestId: 'req-1' }
    })).rejects.toThrow('Account changed');
  });

  it('handles analyses.delete with owner check', async () => {
    const { handleRequest } = await service();
    mock.query.delete.mockReturnValue(mock.query);
    const res = await handleRequest({
      action: 'analyses.delete',
      payload: { accountId: 'owner', id: 'analysis-123' }
    });
    expect(res).toBeNull();
    expect(mock.query.delete).toHaveBeenCalled();
    expect(mock.query.eq).toHaveBeenCalledWith('id', 'analysis-123');
    expect(mock.query.eq).toHaveBeenCalledWith('user_id', 'owner');
  });

  it('rejects stale account before analyses.delete', async () => {
    const { handleRequest } = await service();
    await expect(handleRequest({
      action: 'analyses.delete',
      payload: { accountId: 'previous-owner', id: 'analysis-123' }
    })).rejects.toThrow('Account changed');
  });

  it('handles ai.request.get with result recovery and unavailable state', async () => {
    const { handleRequest } = await service();
    // 1. Immutable request snapshot survives later analysis changes
    mock.query.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'req-1',
          user_id: 'owner',
          status: 'completed',
          operation: 'circuit_check',
          model: 'gemini-3.5-flash-lite',
          language: 'english',
          result_id: 'res-1',
          result_payload: { schemaVersion: 2, status: 'reviewed', summary: 'All good' },
          created_at: '2026-10-16T12:00:00Z',
          finished_at: '2026-10-16T12:00:05Z',
          error_code: null
        },
        error: null
      });

    const res1 = await handleRequest({
      action: 'ai.request.get',
      payload: { accountId: 'owner', requestId: 'req-1' }
    });

    expect(res1).toEqual({
      requestId: 'req-1',
      accountId: 'owner',
      status: 'completed',
      operation: 'circuit_check',
      model: 'gemini-3.5-flash-lite',
      language: 'english',
      resultId: 'res-1',
      result: { schemaVersion: 2, status: 'reviewed', summary: 'All good' },
      errorCode: null,
      createdAt: '2026-10-16T12:00:00Z',
      finishedAt: '2026-10-16T12:00:05Z'
    });

    // 2. Request completed, but analysis was deleted -> returns unavailable
    mock.query.maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: 'req-1',
          user_id: 'owner',
          status: 'completed',
          operation: 'circuit_check',
          model: 'gemini-3.5-flash-lite',
          language: 'english',
          result_id: 'res-1',
          created_at: '2026-10-16T12:00:00Z',
          finished_at: '2026-10-16T12:00:05Z',
          error_code: null
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: null,
        error: null
      });

    const res2 = await handleRequest({
      action: 'ai.request.get',
      payload: { accountId: 'owner', requestId: 'req-1' }
    });

    expect(res2).toEqual(expect.objectContaining({
      status: 'unavailable',
      result: null
    }));
  });

  it('recovers legacy request-owned chat messages and unique circuit artifacts', async () => {
    const { handleRequest } = await service();
    mock.query.maybeSingle.mockResolvedValueOnce({data:{id:'chat',status:'completed',operation:'chat',result_id:'message'},error:null})
      .mockResolvedValueOnce({data:{content:'Saved chat answer',structured_result:null},error:null});
    expect(await handleRequest({action:'ai.request.get',payload:{accountId:'owner',requestId:'chat'}})).toEqual(expect.objectContaining({status:'completed',result:{status:'answer',answer:'Saved chat answer'}}));
    mock.query.maybeSingle.mockResolvedValueOnce({data:{id:'check',status:'completed',operation:'circuit_check',result_id:'artifact'},error:null})
      .mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:{payload:{schemaVersion:2,summary:'Original circuit check'}},error:null});
    expect(await handleRequest({action:'ai.request.get',payload:{accountId:'owner',requestId:'check'}})).toEqual(expect.objectContaining({status:'completed',result:{schemaVersion:2,summary:'Original circuit check'}}));
    expect(mock.query.eq).toHaveBeenCalledWith('user_id','owner');
  });

  it('rejects on session read error rather than interpreting as signed out', async () => {
    const { handleRequest } = await service();
    mock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Session storage corrupted')
    });
    await expect(handleRequest({ action: 'account.state', payload: {} })).rejects.toThrow('Session storage corrupted');
  });

  it('returns signed-out state when session is truly absent with no error', async () => {
    const { handleRequest } = await service();
    mock.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null
    });
    const state = await handleRequest({ action: 'account.state', payload: {} });
    expect(state).toEqual({
      configured: true,
      user: null,
      profile: null,
      assignments: [],
      recovery: false
    });
  });
});

