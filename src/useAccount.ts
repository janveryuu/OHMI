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
  const owner = useRef<string | null>(null);
  const refresh = useCallback(async (accountId?: string | null) => {
    const current = ++sequence.current;
    setLoading(true);
    // Owner hints only invalidate views; account.state still verifies the current user.
    if (accountId !== undefined && accountId !== owner.current) { owner.current = null; setState(empty); setError(''); }
    try {
      const next = await request<AccountState>('account.state');
      if (current === sequence.current) { owner.current = next.user?.id ?? null; setState(next); setError(next.storageError ?? ''); }
    } catch (failure) {
      if (current === sequence.current) { owner.current = null; setState(empty); setError(failure instanceof Error ? failure.message : 'Account disconnected. Retry.'); }
    } finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const changed = (message: { channel?: string; event?: string; accountId?: unknown }, sender: { id?: string }) => {
      if (sender.id === browser.runtime.id && message?.channel === 'ohmi' && message.event === 'account.changed') {
        void refresh(typeof message.accountId === 'string' || message.accountId === null ? message.accountId : null);
      }
    };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    browser.runtime.onMessage.addListener(changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { sequence.current++; browser.runtime.onMessage.removeListener(changed); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return { state, loading, error, refresh };
}
