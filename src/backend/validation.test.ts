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

describe('ai.chat request validation', () => {
  const dummyAcc = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const dummyReq = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  it('accepts valid chat requests and bounds length/context', () => {
    const valid = validateRequest(message('ai.chat', {
      accountId: dummyAcc,
      requestId: dummyReq,
      message: 'Hello OHMI',
      language: 'taglish'
    }), content, id);
    expect(valid.action).toBe('ai.chat');
    expect(valid.payload.message).toBe('Hello OHMI');
  });

  it('rejects missing requestId, oversized message, or invalid language', () => {
    expect(() => validateRequest(message('ai.chat', { accountId: dummyAcc, message: 'Hi' }), content, id)).toThrow();
    expect(() => validateRequest(message('ai.chat', { accountId: dummyAcc, requestId: dummyReq, message: 'x'.repeat(2001), language: 'english' }), content, id)).toThrow();
    expect(() => validateRequest(message('ai.chat', { accountId: dummyAcc, requestId: dummyReq, message: 'Hi', language: 'spanish' }), content, id)).toThrow();
  });

  it('validates optional calculation payload in ai.chat', () => {
    const validCalc = validateRequest(message('ai.chat', {
      accountId: dummyAcc,
      requestId: dummyReq,
      message: 'Calculate LED resistor',
      language: 'english',
      calculation: {
        type: 'led_resistor',
        operands: { supplyVoltage: 5, forwardVoltage: 2, targetCurrent: 0.015 }
      }
    }), content, id);
    expect(validCalc.action).toBe('ai.chat');

    // Rejects unsupported calculation type
    expect(() => validateRequest(message('ai.chat', {
      accountId: dummyAcc,
      requestId: dummyReq,
      message: 'Calc',
      language: 'english',
      calculation: { type: 'unsupported_formula', operands: {} }
    }), content, id)).toThrow('Unsupported calculation type.');
  });
});

describe('ai.circuit request validation', () => {
  const dummyAcc = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const dummyReq = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const checkSender = { id, url: `chrome-extension://${id}/check.html`, tab: { id: 2 }, frameId: 0 };
  const validCircuitPayload = {
    version: 2,
    operation: 'circuit_check',
    requestId: dummyReq,
    accountId: dummyAcc,
    language: 'english',
    mode: 'check',
    board: 'uno-r3',
    message: 'Check this LED circuit',
    images: [],
    code: 'void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }'
  };

  it('rejects ai.circuit from content script or account page', () => {
    expect(() => validateRequest(message('ai.circuit', validCircuitPayload), content, id))
      .toThrow('Action only allowed from circuit check review.');
    expect(() => validateRequest(message('ai.circuit', validCircuitPayload), account, id))
      .toThrow('Action only allowed from circuit check review.');
  });

  it('accepts valid ai.circuit from trusted /check.html sender', () => {
    const validated = validateRequest(message('ai.circuit', validCircuitPayload), checkSender, id);
    expect(validated.action).toBe('ai.circuit');
    expect(validated.payload.requestId).toBe(dummyReq);
  });

  it('rejects ai.circuit with missing accountId or invalid schema', () => {
    expect(() => validateRequest(message('ai.circuit', { ...validCircuitPayload, accountId: undefined }), checkSender, id))
      .toThrow();
    expect(() => validateRequest(message('ai.circuit', { ...validCircuitPayload, mode: 'invalid' }), checkSender, id))
      .toThrow();
  });
});

describe('durable history actions validation', () => {
  const dummyAcc = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const dummyId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('validates conversations actions', () => {
    expect(validateRequest(message('conversations.list', { accountId: dummyAcc }), content, id).action).toBe('conversations.list');
    expect(validateRequest(message('conversations.open', { accountId: dummyAcc, id: dummyId }), content, id).action).toBe('conversations.open');
    expect(validateRequest(message('conversations.create', { accountId: dummyAcc, title: 'Test Title' }), content, id).action).toBe('conversations.create');
    expect(validateRequest(message('conversations.create', { accountId: dummyAcc }), content, id).action).toBe('conversations.create');
    expect(validateRequest(message('conversations.delete', { accountId: dummyAcc, id: dummyId }), content, id).action).toBe('conversations.delete');

    // Missing id for open/delete
    expect(() => validateRequest(message('conversations.open', { accountId: dummyAcc }), content, id)).toThrow();
    expect(() => validateRequest(message('conversations.delete', { accountId: dummyAcc, id: 'invalid-uuid' }), content, id)).toThrow();
    expect(() => validateRequest(message('conversations.create', { accountId: dummyAcc, title: 'a'.repeat(200) }), content, id)).toThrow();
  });

  it('validates analyses actions', () => {
    expect(validateRequest(message('analyses.get', { accountId: dummyAcc, id: dummyId }), content, id).action).toBe('analyses.get');
    expect(validateRequest(message('analyses.list', { accountId: dummyAcc }), content, id).action).toBe('analyses.list');
    expect(validateRequest(message('analyses.list', { accountId: dummyAcc, assignmentId: dummyId }), content, id).action).toBe('analyses.list');
    expect(validateRequest(message('analyses.delete', { accountId: dummyAcc, id: dummyId }), content, id).action).toBe('analyses.delete');

    expect(() => validateRequest(message('analyses.get', { accountId: dummyAcc, id: 'bad' }), content, id)).toThrow();
    expect(() => validateRequest(message('analyses.list', { accountId: dummyAcc, assignmentId: 'bad' }), content, id)).toThrow();
    expect(() => validateRequest(message('analyses.delete', { accountId: dummyAcc, id: 'bad' }), content, id)).toThrow();
  });

  it('validates tutorial progress actions', () => {
    expect(validateRequest(message('progress.get', { accountId: dummyAcc, analysisId: dummyId }), content, id).action).toBe('progress.get');
    expect(validateRequest(message('progress.save', {
      accountId: dummyAcc,
      analysisId: dummyId,
      currentStep: 2,
      completed: [0, 1]
    }), content, id).action).toBe('progress.save');

    // Rejects invalid step bounds or non-integers
    expect(() => validateRequest(message('progress.save', { accountId: dummyAcc, analysisId: dummyId, currentStep: 25, completed: [] }), content, id)).toThrow();
    expect(() => validateRequest(message('progress.save', { accountId: dummyAcc, analysisId: dummyId, currentStep: -1, completed: [] }), content, id)).toThrow();
    expect(() => validateRequest(message('progress.save', { accountId: dummyAcc, analysisId: dummyId, currentStep: 1, completed: [30] }), content, id)).toThrow();
  });

  it('validates ai.request.get actions', () => {
    expect(validateRequest(message('ai.request.get', { accountId: dummyAcc, requestId: dummyId }), content, id).action).toBe('ai.request.get');
    expect(() => validateRequest(message('ai.request.get', { accountId: dummyAcc, requestId: 'invalid-uuid' }), content, id)).toThrow();
    expect(() => validateRequest(message('ai.request.get', { requestId: dummyId }), content, id)).toThrow();
  });

  it('validates circuit.open with optional analysisId', () => {
    expect(validateRequest(message('circuit.open', {}), content, id).action).toBe('circuit.open');
    expect(validateRequest(message('circuit.open', { analysisId: dummyId }), content, id).action).toBe('circuit.open');
    expect(() => validateRequest(message('circuit.open', { analysisId: 'bad-uuid' }), content, id)).toThrow();
  });
});
