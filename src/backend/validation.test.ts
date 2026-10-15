import { describe, expect, it } from 'vitest';
import { validateRequest, validateFile, validateCallback, readPublicConfig } from './validation';

const id = 'ikemolangalcofljjajakagdnfdpnakh';
const content = { id, url: 'https://www.tinkercad.com/things/test/editel', tab: { id: 1 }, frameId: 0 };
const account = { id, url: `chrome-extension://${id}/account.html` };
const message = (action: string, payload: unknown = {}) => ({ channel: 'ohmi', action, payload });

describe('trusted extension requests', () => {
  it('allows local placement from an editor but rejects page/foreign/frame senders', () => {
    expect(validateRequest(message('local.read'), content, id).action).toBe('local.read');
    for (const sender of [{ ...content, id: 'foreign' }, { ...content, url: 'https://evil.example/' }, { ...content, frameId: 1 }]) {
      expect(() => validateRequest(message('local.read'), sender, id)).toThrow();
    }
  });
  it('keeps credentials and upload authorization out of content-script requests', () => {
    expect(validateRequest(message('auth.signIn', { email: 'student@example.com', password: 'a-good-password' }), account, id).action).toBe('auth.signIn');
    for (const action of ['auth.signIn', 'auth.google', 'files.prepare']) expect(() => validateRequest(message(action), content, id)).toThrow();
    expect(() => validateRequest(message('auth.google'), { ...account, url: `chrome-extension://${id}/other.html` }, id)).toThrow();
  });
  it('rejects unknown actions and invalid owner-controlled inputs', () => {
    for (const [action, payload] of [['storage.get', {}], ['files.open', { id: '../someone' }], ['profile.language', { language: 'wrong' }], ['local.position', { position: { x: Infinity, y: 10 }, open: true }]]) {
      expect(() => validateRequest(message(String(action), payload), content, id)).toThrow();
    }
    expect(() => validateRequest(message('steps.add', { assignmentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: ' ' }), content, id)).toThrow();
  });
  it('requires a valid account snapshot for data actions and accepts existing eight-digit OTPs', () => {
    expect(() => validateRequest(message('profile.language', { language: 'taglish' }), content, id)).toThrow();
    expect(validateRequest(message('profile.language', { language: 'taglish', accountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }), content, id).action).toBe('profile.language');
    expect(validateRequest(message('auth.confirm', { email: 'student@example.com', token: '12345678' }), account, id).action).toBe('auth.confirm');
  });
});

describe('public configuration and OAuth callback', () => {
  it('accepts a publishable project key but rejects privileged keys or insecure hosts', () => {
    expect(readPublicConfig('https://example.supabase.co', 'sb_publishable_example')).toEqual({ url: 'https://example.supabase.co', key: 'sb_publishable_example' });
    for (const key of ['sb_secret_example', 'eyJhbGciOiJIUzI1NiJ9.secret', '']) expect(() => readPublicConfig('https://example.supabase.co', key)).toThrow();
    expect(() => readPublicConfig('http://evil.example', 'sb_publishable_example')).toThrow();
  });
  it('accepts only the exact HTTPS callback with a code and no token fragment', () => {
    const callback = `https://${id}.chromiumapp.org/`;
    expect(validateCallback(`${callback}?code=sample-code`, callback)).toBe('sample-code');
    for (const url of [`https://evil.example/?code=x`, `${callback}other?code=x`, `${callback}?error=access_denied`, `${callback}#access_token=x`, `${callback}?code=x#access_token=y`]) {
      expect(() => validateCallback(url, callback)).toThrow();
    }
  });
});

describe('assignment file validation', () => {
  it('accepts a matching PDF signature and rejects oversized, empty, forged, or path filenames', () => {
    const file = { name: 'lab.pdf', size: 1024, mime: 'application/pdf', signature: [37, 80, 68, 70, 45] };
    expect(validateFile(file).extension).toBe('pdf');
    for (const invalid of [{ ...file, size: 10485761 }, { ...file, size: 0 }, { ...file, signature: [1, 2, 3] }, { ...file, mime: 'text/html' }, { ...file, name: '../lab.pdf' }, { ...file, name: 'lab.exe' }]) expect(() => validateFile(invalid)).toThrow();
    expect(validateFile({ name: 'lab.PNG', size: 20, mime: 'image/png', signature: [137, 80, 78, 71, 13, 10, 26, 10] }).extension).toBe('png');
    expect(validateFile({ name: 'lab.jpg', size: 20, mime: 'image/jpeg', signature: [255, 216, 255] }).extension).toBe('jpg');
  });
});
