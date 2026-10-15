import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { request } from './bridge';
import type { AccountState } from './backend/contracts';

const empty: AccountState = { configured: true, user: null, profile: null, assignments: [], recovery: false };

export function useAccount() {
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const next = await request<AccountState>('account.state');
      if (current === sequence.current) { setState(next); setError(next.storageError ?? ''); }
    } catch (failure) {
      if (current === sequence.current) { setState(empty); setError(failure instanceof Error ? failure.message : 'Account disconnected. Retry.'); }
    } finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const changed = (message: { channel?: string; event?: string }) => { if (message?.channel === 'ohmi' && message.event === 'account.changed') void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    browser.runtime.onMessage.addListener(changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { sequence.current++; browser.runtime.onMessage.removeListener(changed); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return { state, loading, error, refresh };
}
