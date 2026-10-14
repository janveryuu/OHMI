import { isCircuitEditorUrl } from '../editor-url';
import { parseAiRequest } from '../../supabase/functions/_shared/ai-core';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const actions = ['local.read', 'local.position', 'local.preferences', 'account.state', 'account.open', 'auth.signIn', 'auth.signUp', 'auth.confirm', 'auth.resend', 'auth.forgot', 'auth.recover', 'auth.password', 'auth.google', 'auth.signOut', 'profile.language', 'profile.name', 'files.prepare', 'files.finish', 'files.open', 'files.delete', 'steps.list', 'steps.add', 'steps.update', 'steps.delete', 'ai.chat', 'ai.analyze', 'ai.conversations', 'ai.conversation.create', 'ai.conversation.delete', 'ai.messages', 'ai.analyses', 'ai.analysis', 'ai.progress.save', 'ai.usage'] as const;
export type Action = typeof actions[number];
export type Request = { action: Action; payload: Record<string, unknown> };
type Sender = { id?: string; url?: string; tab?: { id?: number }; frameId?: number };
const trustedOnly = new Set<string>([...actions.filter((action) => action.startsWith('auth.')), 'profile.name', 'files.prepare', 'files.finish']);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request.');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Check the entered value.');
  return value.trim();
};
const uuid = (value: unknown) => {
  if (typeof value !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) throw new Error('Invalid record ID.');
};

export function validateRequest(message: unknown, sender: Sender, extensionId: string): Request {
  const request = object(message);
  if (request.channel !== 'ohmi' || sender.id !== extensionId || !sender.url) throw new Error('Request not allowed.');
  const url = new URL(sender.url);
  const trusted = url.protocol === 'chrome-extension:' && url.hostname === extensionId && url.pathname === '/account.html';
  const editor = typeof sender.tab?.id === 'number' && sender.frameId === 0 && isCircuitEditorUrl(url);
  if (!trusted && !editor) throw new Error('Request not allowed.');
  if (typeof request.action !== 'string' || !actions.includes(request.action as Action)) throw new Error('Unknown request.');
  const action = request.action as Action;
  if (trustedOnly.has(action) && !trusted) throw new Error('Open OHMI Account to use this action.');
  const payload = object(request.payload ?? {});
  if (action.startsWith('profile.') || action.startsWith('files.') || action.startsWith('steps.') || action.startsWith('ai.')) uuid(payload.accountId);
  if (action === 'ai.chat' || action === 'ai.analyze') parseAiRequest({ ...payload, kind: action === 'ai.chat' ? 'chat' : 'analyze' });
  if (['ai.messages','ai.conversation.delete'].includes(action)) uuid(payload.conversationId);
  if (action === 'ai.conversation.create' && payload.analysisId !== undefined) uuid(payload.analysisId);
  if (action === 'ai.analysis' || action === 'ai.progress.save') uuid(payload.analysisId);
  if (action === 'ai.progress.save' && (!Number.isInteger(payload.currentStep) || Number(payload.currentStep)<0 || Number(payload.currentStep)>=24 || !Array.isArray(payload.completed) || payload.completed.length>24 || payload.completed.some(index=>!Number.isInteger(index)||index<0||index>=24))) throw new Error('Invalid tutorial progress.');
  if (action === 'local.position') {
    const position = object(payload.position);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || typeof payload.open !== 'boolean') throw new Error('Invalid mascot position.');
  }
  if (action === 'local.preferences' && (!['english', 'filipino', 'taglish'].includes(String(payload.language)) || !['light', 'dark'].includes(String(payload.appearance)) || typeof payload.animations !== 'boolean')) throw new Error('Invalid preferences.');
  if (action === 'account.open' && payload.view !== undefined && !['auth', 'upload'].includes(String(payload.view))) throw new Error('Invalid account view.');
  if (['auth.signIn', 'auth.signUp', 'auth.confirm', 'auth.resend', 'auth.forgot', 'auth.recover'].includes(action)) {
    const email = text(payload.email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    payload.email = email;
  }
  if (['auth.signIn', 'auth.signUp', 'auth.password'].includes(action) && (typeof payload.password !== 'string' || payload.password.length < (action === 'auth.signIn' ? 1 : 10) || new TextEncoder().encode(payload.password).length > 72)) throw new Error('Use a password of at least 10 characters and at most 72 bytes.');
  if (['auth.confirm', 'auth.recover'].includes(action) && (typeof payload.token !== 'string' || !/^\d{6,10}$/.test(payload.token))) throw new Error('Enter the verification code from your email.');
  if (action === 'profile.language' && !['english', 'filipino', 'taglish'].includes(String(payload.language))) throw new Error('Invalid language.');
  if (action === 'profile.name' && (typeof payload.name !== 'string' || payload.name.length > 80 || /[\x00-\x1f]/.test(payload.name))) throw new Error('Use a name of at most 80 characters.');
  if (['files.finish', 'files.open', 'files.delete', 'steps.update', 'steps.delete'].includes(action)) uuid(payload.id);
  if (['steps.list', 'steps.add'].includes(action)) uuid(payload.assignmentId);
  if (action === 'steps.add') payload.title = text(payload.title, 500);
  if (action === 'steps.update' && typeof payload.completed !== 'boolean') throw new Error('Invalid step state.');
  if (action === 'files.prepare') validateFile(payload);
  return { action, payload };
}

export function validateFile(value: unknown) {
  const file = object(value);
  const name = text(file.name, 180);
  if (/[\\/\x00-\x1f\x7f]/.test(name)) throw new Error('Use a filename without paths or control characters.');
  if (typeof file.size !== 'number' || !Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error('Choose a file between 1 byte and 10 MiB.');
  const signature = file.signature;
  if (!Array.isArray(signature) || signature.length > 16 || signature.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Invalid file signature.');
  const starts = (bytes: number[]) => bytes.every((byte, index) => signature[index] === byte);
  let extension: 'pdf' | 'png' | 'jpg';
  if (file.mime === 'application/pdf' && /\.pdf$/i.test(name) && starts([37, 80, 68, 70, 45])) extension = 'pdf';
  else if (file.mime === 'image/png' && /\.png$/i.test(name) && starts([137, 80, 78, 71, 13, 10, 26, 10])) extension = 'png';
  else if (file.mime === 'image/jpeg' && /\.jpe?g$/i.test(name) && starts([255, 216, 255])) extension = 'jpg';
  else throw new Error('Choose a valid PDF, PNG, or JPG file with a matching file type.');
  return { name, size: file.size, mime: file.mime as string, extension };
}

export function readPublicConfig(urlValue: unknown, key: unknown) {
  if (typeof urlValue !== 'string' || typeof key !== 'string' || !/^sb_publishable_[\w-]+$/.test(key)) throw new Error('Configure the Supabase Project URL and publishable key.');
  const url = new URL(urlValue);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use the HTTPS Supabase project URL.');
  return { url: url.origin, key };
}

export function validateCallback(value: string, expected: string): string {
  const url = new URL(value);
  const target = new URL(expected);
  if (target.protocol !== 'https:' || !/^[a-p]{32}\.chromiumapp\.org$/.test(target.hostname) || url.origin !== target.origin || url.pathname !== target.pathname || url.hash) throw new Error('Authentication returned an unexpected callback.');
  if (url.searchParams.has('error')) throw new Error('Google sign-in was cancelled or refused. Try again.');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1) throw new Error('Authentication did not return a valid code.');
  return code;
}
