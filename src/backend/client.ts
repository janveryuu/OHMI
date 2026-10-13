import { createClient } from '@supabase/supabase-js';
import { browser } from 'wxt/browser';
import { readPublicConfig } from './validation';
import type { Database } from './database.types';

export const AUTH_STORAGE_KEY = 'ohmi-auth';
export const authStorage = {
  async getItem(key: string): Promise<string | null> { const value = (await browser.storage.local.get(key))[key]; return typeof value === 'string' ? value : null; },
  async setItem(key: string, value: string) { await browser.storage.local.set({ [key]: value }); },
  async removeItem(key: string) { await browser.storage.local.remove(key); },
};

export function createBackendClient() {
  const config = readPublicConfig(import.meta.env.WXT_SUPABASE_URL, import.meta.env.WXT_SUPABASE_PUBLISHABLE_KEY);
  // getSession refreshes expired tokens on demand; a polling timer would keep the MV3 worker awake.
  const client = createClient<Database>(config.url, config.key, { auth: { storage: authStorage, storageKey: AUTH_STORAGE_KEY, flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
  return { client, config };
}
