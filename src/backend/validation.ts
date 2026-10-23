import { isCircuitEditorUrl } from '../editor-url';
import { validateCircuitRequest } from '../ai/circuit';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const actions = [
  'local.read', 'local.position', 'local.preferences', 'account.state', 'account.open',
  'auth.signIn', 'auth.signUp', 'auth.confirm', 'auth.resend', 'auth.forgot', 'auth.recover', 'auth.password', 'auth.google', 'auth.signOut',
  'profile.language', 'profile.name',
  'files.prepare', 'files.finish', 'files.open', 'files.delete',
  'steps.list', 'steps.add', 'steps.update', 'steps.delete',
  'conversations.list', 'conversations.open', 'conversations.create', 'conversations.delete',
  'analyses.get', 'analyses.list', 'analyses.delete',
  'progress.get', 'progress.save',
  'ai.chat', 'ai.circuit', 'ai.request.get',
  'circuit.open', 'capture.claim'
] as const;
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
  const trustedAccount = url.protocol === 'chrome-extension:' && url.hostname === extensionId && url.pathname === '/account.html';
  const trustedCheck = url.protocol === 'chrome-extension:' && url.hostname === extensionId && url.pathname === '/check.html' && sender.frameId === 0;
  const editor = typeof sender.tab?.id === 'number' && sender.frameId === 0 && isCircuitEditorUrl(url);
  if (!trustedAccount && !trustedCheck && !editor) throw new Error('Request not allowed.');
  if (typeof request.action !== 'string' || !actions.includes(request.action as Action)) throw new Error('Unknown request.');
  const action = request.action as Action;
  if (trustedOnly.has(action) && !trustedAccount) throw new Error('Open OHMI Account to use this action.');
  if (action === 'capture.claim' && (!trustedCheck || typeof sender.tab?.id !== 'number')) {
    throw new Error('Action only allowed from circuit check review.');
  }
  if (action === 'ai.circuit' && !trustedCheck) {
    throw new Error('Action only allowed from circuit check review.');
  }
  const payload = object(request.payload ?? {});
  if (action === 'capture.claim' && sender.tab?.id) {
    payload.callerTabId = sender.tab.id;
  }
  if (action.startsWith('profile.') || action.startsWith('files.') || action.startsWith('steps.') || action.startsWith('conversations.') || action.startsWith('analyses.') || action.startsWith('progress.') || action === 'ai.chat' || action === 'ai.circuit' || action === 'ai.request.get') uuid(payload.accountId);
  if (action === 'local.position') {
    const position = object(payload.position);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || typeof payload.open !== 'boolean') throw new Error('Invalid mascot position.');
  }
  if (action === 'local.preferences' && (!['english', 'filipino', 'taglish'].includes(String(payload.language)) || !['light', 'dark'].includes(String(payload.appearance)) || typeof payload.animations !== 'boolean')) throw new Error('Invalid preferences.');
  if (action === 'account.open' && payload.view !== undefined && !['auth', 'upload'].includes(String(payload.view))) throw new Error('Invalid account view.');
  if (action === 'circuit.open' && payload.analysisId !== undefined) uuid(payload.analysisId);
  if (['auth.signIn', 'auth.signUp', 'auth.confirm', 'auth.resend', 'auth.forgot', 'auth.recover'].includes(action)) {
    const email = text(payload.email, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    payload.email = email;
  }
  if (['auth.signIn', 'auth.signUp', 'auth.password'].includes(action) && (typeof payload.password !== 'string' || payload.password.length < (action === 'auth.signIn' ? 1 : 10) || new TextEncoder().encode(payload.password).length > 72)) throw new Error('Use a password of at least 10 characters and at most 72 bytes.');
  if (['auth.confirm', 'auth.recover'].includes(action) && (typeof payload.token !== 'string' || !/^\d{6,10}$/.test(payload.token))) throw new Error('Enter the verification code from your email.');
  if (action === 'profile.language' && !['english', 'filipino', 'taglish'].includes(String(payload.language))) throw new Error('Invalid language.');
  if (action === 'profile.name' && (typeof payload.name !== 'string' || payload.name.length > 80 || /[\x00-\x1f]/.test(payload.name))) throw new Error('Use a name of at most 80 characters.');
  if (['files.finish', 'files.open', 'files.delete', 'steps.update', 'steps.delete', 'conversations.open', 'conversations.delete', 'analyses.get', 'analyses.delete'].includes(action)) uuid(payload.id);
  if (action === 'conversations.open' && payload.beforePosition !== undefined) {
    if (typeof payload.beforePosition !== 'number' || !Number.isInteger(payload.beforePosition) || payload.beforePosition < 1) {
      throw new Error('Invalid beforePosition.');
    }
  }
  if (action === 'ai.request.get') uuid(payload.requestId);
  if (['steps.list', 'steps.add'].includes(action)) uuid(payload.assignmentId);
  if (action === 'analyses.list' && payload.assignmentId !== undefined) uuid(payload.assignmentId);
  if (['progress.get', 'progress.save'].includes(action)) uuid(payload.analysisId);
  if (action === 'progress.save') {
    if (typeof payload.currentStep !== 'number' || payload.currentStep < 0 || payload.currentStep > 23 || !Number.isInteger(payload.currentStep)) throw new Error('Invalid step index.');
    if (!Array.isArray(payload.completed) || payload.completed.length > 24 || payload.completed.some(s => typeof s !== 'number' || s < 0 || s > 23 || !Number.isInteger(s))) throw new Error('Invalid completed steps.');
  }
  if (action === 'steps.add') payload.title = text(payload.title, 500);
  if (action === 'conversations.create' && payload.title !== undefined) payload.title = text(payload.title, 160);
  if (action === 'steps.update' && typeof payload.completed !== 'boolean') throw new Error('Invalid step state.');
  if (action === 'files.prepare') validateFile(payload);
  if (action === 'ai.chat') {
    uuid(payload.requestId);
    payload.message = text(payload.message, 2000);
    if (!['english', 'filipino', 'taglish'].includes(String(payload.language))) throw new Error('Invalid language.');
    if (payload.code !== undefined && (typeof payload.code !== 'string' || payload.code.length > 8000)) throw new Error('Invalid code length.');
    if (payload.assignmentId !== undefined) uuid(payload.assignmentId);
    if (payload.circuitAnalysisId !== undefined) uuid(payload.circuitAnalysisId);
    if (payload.conversationId !== undefined) uuid(payload.conversationId);
    if (payload.historyThroughPosition !== undefined) {
      if (typeof payload.historyThroughPosition !== 'number' || !Number.isInteger(payload.historyThroughPosition) || payload.historyThroughPosition < 0) {
        throw new Error('Invalid historyThroughPosition.');
      }
    }
    if (payload.context !== undefined && (!Array.isArray(payload.context) || payload.context.length > 4)) throw new Error('Invalid context.');
    if (payload.calculation !== undefined) {
      if (typeof payload.calculation !== 'object' || payload.calculation === null) throw new Error('Invalid calculation payload.');
      const calc = payload.calculation as Record<string, unknown>;
      if (!['ohms_law', 'led_resistor', 'series_resistance', 'parallel_resistance', 'resistor_power'].includes(String(calc.type))) {
        throw new Error('Unsupported calculation type.');
      }
      if (typeof calc.operands !== 'object' || calc.operands === null) throw new Error('Invalid calculation operands.');
    }
  }
  if (action === 'ai.circuit') {
    validateCircuitRequest(payload);
  }
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
