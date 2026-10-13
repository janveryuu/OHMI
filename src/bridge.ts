import { browser } from 'wxt/browser';
import type { Response } from './backend/contracts';
import type { Action } from './backend/validation';

export async function request<T>(action: Action, payload: unknown = {}): Promise<T> {
  const response: Response<T> | undefined = await browser.runtime.sendMessage({ channel: 'ohmi', action, payload });
  if (!response) throw new Error('OHMI disconnected. Reload the extension and this tab.');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
